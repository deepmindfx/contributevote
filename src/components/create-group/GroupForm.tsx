
import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createContributionGroupAccount } from "@/services/monnifyApi";
import { useApp } from "@/contexts/AppContext";

// Import Step Components
import DetailsStep from "./DetailsStep";
import ScheduleStep from "./ScheduleStep";
import SettingsStep from "./SettingsStep";
import StepIndicator from "./StepIndicator";

// Define visibility type to fix TypeScript error
type VisibilityType = "public" | "private" | "invite-only";

const GroupForm = () => {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { createNewContribution, user } = useApp();
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    targetAmount: 0,
    category: 'personal',
    frequency: 'monthly' as 'daily' | 'weekly' | 'monthly' | 'one-time',
    contributionAmount: 0,
    startDate: '',
    endDate: '',
    votingThreshold: 70,
    privacy: 'private' as 'public' | 'private',
    memberRoles: 'equal' as 'equal' | 'weighted',
    notifyContributions: true,
    notifyVotes: true,
    notifyUpdates: true,
    // Fields for account creation
    bvn: '',
    accountReference: `GROUP_${Date.now()}`,
  });

  const [validationErrors, setValidationErrors] = useState<{
    bvn?: string;
  }>({});

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear validation errors when field is updated
    if (validationErrors[field as keyof typeof validationErrors]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field as keyof typeof validationErrors];
        return newErrors;
      });
    }
  };

  const validateStep = (currentStep: number) => {
    if (currentStep === 1) {
      if (!formData.name.trim()) {
        toast.error("Group name is required");
        return false;
      }
      if (formData.targetAmount <= 0) {
        toast.error("Target amount must be greater than zero");
        return false;
      }
    } else if (currentStep === 2) {
      if (formData.contributionAmount <= 0) {
        toast.error("Contribution amount must be greater than zero");
        return false;
      }
      if (!formData.startDate) {
        toast.error("Start date is required");
        return false;
      }
    } else if (currentStep === 3) {
      // Validate BVN if we're on the settings step
      const errors: {bvn?: string} = {};
      
      if (!formData.bvn.trim()) {
        errors.bvn = "BVN is required to create a dedicated account for the group";
      } else if (formData.bvn.length !== 11 || !/^\d+$/.test(formData.bvn)) {
        errors.bvn = "BVN must be 11 digits";
      }
      
      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        return false;
      }
    }
    
    return true;
  };

  const goToNextStep = () => {
    if (!validateStep(step)) {
      return;
    }
    
    window.scrollTo(0, 0);
    setStep(step + 1);
  };

  const goToPreviousStep = () => {
    window.scrollTo(0, 0);
    setStep(step - 1);
  };

  const handleCreateGroup = async () => {
    if (!validateStep(step)) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Create a unique account reference for this group
      const accountRef = `GROUP_${user.id}_${Date.now()}`;
      
      // Create a virtual account for the group first
      const accountData = {
        accountReference: accountRef,
        accountName: formData.name, // Use the group name directly
        currencyCode: "NGN",
        contractCode: "465595618981", // Use the updated contract code
        customerEmail: user.email,
        customerName: formData.name,  // Use the group name for customer name too
        customerBvn: formData.bvn
      };
      
      console.log("Creating contribution group account:", accountData);
      const accountResponse = await createContributionGroupAccount(accountData);
      
      if (!accountResponse.requestSuccessful) {
        toast.error(accountResponse.message || "Failed to create account for the group");
        setIsLoading(false);
        return;
      }
      
      // Extract account details from response
      const accountDetails = accountResponse.responseBody;
      console.log("Account creation successful:", accountDetails);
      
      // Prepare contribution data with account details
      const contributionData = {
        name: formData.name,
        description: formData.description,
        targetAmount: Number(formData.targetAmount),
        category: formData.category as "personal" | "business" | "family" | "event" | "education" | "other", 
        frequency: formData.frequency,
        contributionAmount: Number(formData.contributionAmount),
        startDate: formData.startDate,
        endDate: formData.endDate || undefined,
        votingThreshold: formData.votingThreshold,
        privacy: formData.privacy,
        memberRoles: formData.memberRoles,
        creatorId: user.id,
        // Setting required properties to meet the type requirements
        visibility: formData.privacy === 'public' ? 'public' as VisibilityType : 'private' as VisibilityType,
        status: 'active' as 'active' | 'completed' | 'expired',
        deadline: formData.endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        // Add account details
        accountNumber: accountDetails.accounts[0].accountNumber,
        bankName: accountDetails.accounts[0].bankName,
        accountName: formData.name, // Use group name as account name
        accountReference: accountRef, // Save the account reference for future API calls
        accountDetails: accountDetails,
      };
      
      // Create contribution
      createNewContribution(contributionData);
      
      toast.success("Group created successfully with dedicated account");
      
      // Navigate to dashboard
      navigate("/dashboard");
    } catch (error) {
      console.error("Error creating group:", error);
      toast.error(`Failed to create group: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Render the appropriate step
  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <DetailsStep 
            formData={formData} 
            handleChange={handleChange} 
            goToNextStep={goToNextStep} 
          />
        );
      case 2:
        return (
          <ScheduleStep 
            formData={formData} 
            handleChange={handleChange} 
            goToNextStep={goToNextStep} 
            goToPreviousStep={goToPreviousStep} 
          />
        );
      case 3:
        return (
          <SettingsStep 
            formData={formData} 
            handleChange={handleChange} 
            handleCreateGroup={handleCreateGroup} 
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
    <Card className="shadow-none border-0 p-6">
      <StepIndicator currentStep={step} />
      {renderStep()}
    </Card>
  );
};

export default GroupForm;
