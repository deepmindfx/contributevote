
import React from "react";
import { DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { UseFormReturn } from "react-hook-form";
import { IdFormData } from "@/hooks/useReservedAccount";

interface IdFormDialogProps {
  form: UseFormReturn<IdFormData>;
  onSubmit: (values: IdFormData) => void;
  isLoading: boolean;
  onClose: () => void;
  open: boolean;
}

const IdFormDialog = ({ form, onSubmit, isLoading, onClose, open }: IdFormDialogProps) => {
  if (!open) return null;
  
  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Verify Your Identity</DialogTitle>
        <DialogDescription>
          Provide your BVN or NIN to create a virtual account. Your information is secure and will only be used for verification.
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
          <FormField
            control={form.control}
            name="idType"
            render={({ field }) => (
              <FormItem className="space-y-1">
                <FormLabel>ID Type</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="flex space-x-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="bvn" id="bvn" />
                      <label htmlFor="bvn" className="text-sm font-medium">BVN</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="nin" id="nin" />
                      <label htmlFor="nin" className="text-sm font-medium">NIN</label>
                    </div>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="idNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ID Number</FormLabel>
                <FormControl>
                  <Input placeholder="Enter your BVN or NIN" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-[#2DAE75] hover:bg-[#249e69]"
            >
              {isLoading ? "Verifying..." : "Verify & Create Account"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
};

export default IdFormDialog;
