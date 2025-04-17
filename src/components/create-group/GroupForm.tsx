
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import DetailsStep from "./DetailsStep";
import ScheduleStep from "./ScheduleStep";
import SettingsStep from "./SettingsStep";
import StepIndicator from "./StepIndicator";
import { useUser } from "@/contexts/UserContext";
import { useContribution } from "@/contexts/ContributionContext";
import { toast } from "sonner";
import { createContributionGroupAccount } from "@/services/monnify/accountCreation";
import { MonnifyApiResponse, SimpleResponse } from "@/services/monnify/types";

interface FormData {
  name: string;
  description: string;
  targetAmount: number;
  category: string;
  frequency: "daily" | "weekly" | "monthly" | "one-time";
  contributionAmount: number;
  startDate: string;
  endDate: string;
  isPublic: boolean;
  requireApproval: boolean;
  isFixedContribution: boolean;
  allowAnonymous: boolean;
  isOpenToJoin: boolean;
  allowWithdrawals: boolean;
  accountReference: string;
}

const GroupForm = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { createNewContribution } = useContribution();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    description: "",
    targetAmount: 0,
    category: "general",
    frequency: "one-time",
    contributionAmount: 0,
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // Default 30 days
    isPublic: true,
    requireApproval: false,
    isFixedContribution: false,
    allowAnonymous: true,
    isOpenToJoin: true,
    allowWithdrawals: true,
    accountReference: ""
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{
    [key: string]: string;
  }>({});
  
  const MAX_STEPS = 3;
  
  // Listen for changes in formData.targetAmount to update minimum contribution
  useEffect(() => {
    // Set default contribution amount to 5% of target amount or 1000, whichever is less
    if (formData.targetAmount > 0 && !formData.contributionAmount) {
      const defaultAmount = Math.min(Math.ceil(formData.targetAmount * 0.05), 1000);
      handleChange("contributionAmount", defaultAmount);
    }
  }, [formData.targetAmount]);
  
  // Handle form field changes
  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear validation error when field is updated
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };
  
  // Validate the current step
  const validateStep = () => {
    const errors: { [key: string]: string } = {};
    
    if (currentStep === 1) {
      if (!formData.name.trim()) {
        errors.name = "Group name is required";
      }
      if (!formData.description.trim()) {
        errors.description = "Description is required";
      }
      if (formData.targetAmount <= 0) {
        errors.targetAmount = "Target amount must be greater than zero";
      }
    } else if (currentStep === 2) {
      if (formData.contributionAmount < 0) {
        errors.contributionAmount = "Contribution amount cannot be negative";
      }
      if (new Date(formData.startDate) > new Date(formData.endDate)) {
        errors.endDate = "End date must be after start date";
      }
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // Move to the next step
  const goToNextStep = () => {
    if (validateStep()) {
      if (currentStep < MAX_STEPS) {
        setCurrentStep(prev => prev + 1);
        window.scrollTo(0, 0);
      } else {
        handleSubmit();
      }
    }
  };
  
  // Move to the previous step
  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
      window.scrollTo(0, 0);
    }
  };
  
  // Create a Monnify account for the contribution group
  const createGroupAccount = async () => {
    if (!user || !user.name || !user.bvn) {
      toast.error("BVN is required to create a contribution group");
      return null;
    }
    
    const groupAccountRef = `GROUP_${uuidv4()}_${Date.now()}`;
    
    const accountResult = await createContributionGroupAccount({
      accountReference: groupAccountRef,
      accountName: formData.name,
      currencyCode: "NGN",
      contractCode: "465595618981",
      customerEmail: user.email,
      customerName: user.name,
      customerBvn: user.bvn
    });
    
    // Handle the different response types correctly
    if ((accountResult as SimpleResponse).success === false) {
      toast.error((accountResult as SimpleResponse).message || "Failed to create group account");
      return null;
    }
    
    const apiResponse = accountResult as MonnifyApiResponse;
    if (!apiResponse.requestSuccessful) {
      toast.error(apiResponse.responseMessage || "Failed to create group account");
      return null;
    }
    
    return apiResponse.responseBody;
  };
  
  // Submit the form data
  const handleSubmit = async () => {
    if (!validateStep()) return;
    
    setIsLoading(true);
    
    try {
      // Create bank account for the group
      const accountDetails = await createGroupAccount();
      
      if (!accountDetails) {
        setIsLoading(false);
        toast.error("Failed to create bank account for the group");
        return;
      }
      
      // Create a new contribution with the form data
      const contribution = {
        id: uuidv4(),
        name: formData.name,
        description: formData.description,
        targetAmount: formData.targetAmount,
        currentAmount: 0,
        category: formData.category,
        frequency: formData.frequency,
        contributionAmount: formData.contributionAmount,
        createdBy: user.id,
        createdAt: new Date().toISOString(),
        startDate: formData.startDate,
        endDate: formData.endDate,
        members: [user.id],
        contributors: [],
        isPublic: formData.isPublic,
        requireApproval: formData.requireApproval,
        isFixedContribution: formData.isFixedContribution,
        allowAnonymous: formData.allowAnonymous,
        isOpenToJoin: formData.isOpenToJoin,
        allowWithdrawals: formData.allowWithdrawals,
        accountNumber: accountDetails.accounts?.[0]?.accountNumber || "",
        accountBank: accountDetails.accounts?.[0]?.bankName || "",
        accountReference: accountDetails.accountReference,
        accountDetails: accountDetails
      };
      
      createNewContribution(contribution);
      
      // Navigate to the detail page for the new contribution
      navigate(`/groups/${contribution.id}`);
      
      toast.success("Contribution group created successfully!");
    } catch (error) {
      console.error("Error creating contribution group:", error);
      toast.error("Failed to create contribution group");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Render the appropriate step based on currentStep
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <DetailsStep
            formData={formData}
            handleChange={handleChange}
            goToNextStep={goToNextStep}
            validationErrors={validationErrors}
          />
        );
      case 2:
        return (
          <ScheduleStep
            formData={formData}
            handleChange={handleChange}
            goToNextStep={goToNextStep}
            goToPreviousStep={goToPreviousStep}
            validationErrors={validationErrors}
          />
        );
      case 3:
        return (
          <SettingsStep
            formData={formData}
            handleChange={handleChange}
            handleSubmit={handleSubmit}
            goToPreviousStep={goToPreviousStep}
            isLoading={isLoading}
            validationErrors={validationErrors}
          />
        );
      default:
        return null;
    }
  };
  
  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <Card className="mb-8 border-0 shadow-none bg-transparent">
        <CardContent className="p-0">
          <StepIndicator currentStep={currentStep} totalSteps={MAX_STEPS} />
        </CardContent>
      </Card>
      
      <Card className="glass-card">
        <CardContent className="p-6">
          {renderStep()}
        </CardContent>
      </Card>
      
      <div className="mt-6 text-center text-sm text-muted-foreground">
        <p>
          By creating a contribution group, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
};

export default GroupForm;
