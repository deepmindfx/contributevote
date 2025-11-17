import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createGroupVirtualAccount } from "@/services/flutterwave/virtualAccounts";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import { createGroupWithFee, checkGroupCreationEligibility } from '@/services/supabase/groupEnhancementService';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Import Step Components
import DetailsStep from "./DetailsStep";
import ScheduleStep from "./ScheduleStep";
import SettingsStep from "./SettingsStep";
import StepIndicator from "./StepIndicator";

// Define visibility type to fix TypeScript error
type VisibilityType = "public" | "private" | "invite-only";

const FORM_STORAGE_KEY = 'group_creation_form_data';
const STEP_STORAGE_KEY = 'group_creation_step';

const GroupForm = () => {
  const navigate = useNavigate();
  const { user } = useSupabaseUser();
  const { createNewContribution } = useSupabaseContribution();
  
  // Initialize state from localStorage if available
  const [step, setStep] = useState(() => {
    const savedStep = localStorage.getItem(STEP_STORAGE_KEY);
    return savedStep ? parseInt(savedStep, 10) : 1;
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [showFeeConfirmation, setShowFeeConfirmation] = useState(false);
  const [eligibility, setEligibility] = useState<any>(null);
  
  // Form state - restore from localStorage if available
  const [formData, setFormData] = useState(() => {
    const savedData = localStorage.getItem(FORM_STORAGE_KEY);
    if (savedData) {
      try {
        return JSON.parse(savedData);
      } catch (error) {
        console.error('Error parsing saved form data:', error);
      }
    }
    return {
      name: '',
      description: '',
      targetAmount: 0,
      category: 'personal',
      frequency: 'monthly' as 'daily' | 'weekly' | 'monthly' | 'one-time',
      contributionAmount: 0,
      startDate: '',
      endDate: '',
      votingThreshold: 60,
      privacy: 'private' as 'public' | 'private',
      memberRoles: 'equal' as 'equal' | 'weighted',
      enableVotingRights: true,
      notifyContributions: true,
      notifyVotes: true,
      notifyUpdates: true,
      bvn: '',
      accountReference: `GROUP_${Date.now()}`,
    };
  });

  const [validationErrors, setValidationErrors] = useState<{
    bvn?: string;
  }>({});

  // Save form data to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(formData));
  }, [formData]);

  // Save step to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(STEP_STORAGE_KEY, step.toString());
  }, [step]);

  // Check eligibility on mount
  useEffect(() => {
    if (user?.id) {
      checkEligibility();
    }
  }, [user]);

  const checkEligibility = async () => {
    try {
      const result = await checkGroupCreationEligibility(user.id);
      setEligibility(result);
    } catch (error) {
      console.error('Error checking eligibility:', error);
    }
  };

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

    // Check if fee is required and show confirmation
    if (eligibility && !eligibility.can_create_free) {
      setShowFeeConfirmation(true);
      return;
    }

    // Proceed with creation
    await createGroup();
  };

  const createGroup = async () => {
    setIsLoading(true);
    
    try {
      // Use the new service that handles fee deduction
      const result = await createGroupWithFee(user.id, {
        name: formData.name,
        description: formData.description,
        target_amount: Number(formData.targetAmount),
        category: formData.category,
        frequency: formData.frequency,
        privacy: formData.privacy,
        enable_voting_rights: formData.enableVotingRights,
      });
      
      // Get the created group ID
      const groupId = result?.group_id || result?.id;
      
      if (groupId && formData.bvn && formData.bvn.length === 11) {
        // Create virtual account for the group only if BVN is provided
        try {
          const accountData = await createGroupVirtualAccount({
            email: user.email,
            bvn: formData.bvn,
            groupName: formData.name,
            groupId: groupId,
          });

          console.log('Virtual account created:', accountData);
          
          if (accountData.success) {
            toast.success("Group created with bank account!");
          } else {
            toast.warning("Group created, but bank account setup failed. You can set it up later from the group page.");
          }
        } catch (accountError) {
          console.error('Error creating virtual account:', accountError);
          // Don't fail the whole process if virtual account creation fails
          toast.warning("Group created, but bank account setup failed. You can set it up later from the group page.");
        }
      } else {
        // Group created without bank account
        toast.success("Group created successfully! You can set up a bank account later from the group page.");
      }
      
      // Clear localStorage after successful creation
      localStorage.removeItem(FORM_STORAGE_KEY);
      localStorage.removeItem(STEP_STORAGE_KEY);
      
      // Small delay to ensure data is synced
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Navigate to dashboard
      navigate("/dashboard");
    } catch (error) {
      console.error("Error creating group:", error);
      toast.error(`Failed to create group: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsLoading(false);
      setShowFeeConfirmation(false);
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
    <>
      <Card className="shadow-none border-0 p-6">
        {/* Auto-save notification */}
        {(formData.name || formData.description || formData.targetAmount > 0) && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg">
            <p className="text-xs text-blue-800 dark:text-blue-200 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Your progress is automatically saved. You can safely refresh or come back later.
            </p>
          </div>
        )}
        
        <StepIndicator current={step} totalSteps={3} />
        {renderStep()}
      </Card>

      {/* Fee Confirmation Dialog */}
      <AlertDialog open={showFeeConfirmation} onOpenChange={setShowFeeConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <span className="text-2xl">⚠️</span>
              Confirm Group Creation Fee
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <div className="bg-yellow-50 dark:bg-yellow-950/30 border-2 border-yellow-200 dark:border-yellow-900 rounded-lg p-4">
                <p className="text-yellow-900 dark:text-yellow-200 font-semibold mb-2">
                  ⚠️ Payment Required
                </p>
                <p className="text-yellow-800 dark:text-yellow-300 text-sm">
                  You've used all 3 free group creations. A fee of <strong className="text-orange-600 text-lg">₦500</strong> will be <strong>deducted from your wallet balance</strong> to create this group.
                </p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg p-3">
                <p className="font-medium mb-2 text-blue-900 dark:text-blue-200">What you get:</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-blue-800 dark:text-blue-300">
                  <li>Dedicated bank account for the group</li>
                  <li>Full admin controls</li>
                  <li>Unlimited members</li>
                  <li>Voting and governance features</li>
                </ul>
              </div>

              <p className="text-sm text-muted-foreground">
                By clicking "Confirm & Pay ₦500", you authorize this deduction from your wallet.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={createGroup}
              disabled={isLoading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isLoading ? "Processing..." : "Confirm & Pay ₦500"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default GroupForm;
