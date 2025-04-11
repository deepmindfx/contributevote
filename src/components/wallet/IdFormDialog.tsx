
import React from "react";
import { DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { UseFormReturn } from "react-hook-form";
import { z } from "zod";

// Form schema for validation
const idFormSchema = z.object({
  idType: z.enum(["bvn", "nin"], {
    required_error: "Please select an ID type",
  }),
  idNumber: z.string()
    .min(10, "ID number must be at least 10 digits")
    .max(11, "ID number cannot exceed 11 digits")
    .regex(/^\d+$/, "ID number must contain only digits"),
});

type IdFormValues = z.infer<typeof idFormSchema>;

interface IdFormDialogProps {
  form: UseFormReturn<IdFormValues>;
  onSubmit: (values: IdFormValues) => void;
  isLoading: boolean;
  onClose: () => void;
}

const IdFormDialog = ({ form, onSubmit, isLoading, onClose }: IdFormDialogProps) => {
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Provide Identification</DialogTitle>
        <DialogDescription>
          We need your BVN or NIN to create your virtual account. This information is required by financial regulations.
        </DialogDescription>
      </DialogHeader>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="idType"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel>ID Type</FormLabel>
                <RadioGroup 
                  onValueChange={field.onChange} 
                  defaultValue={field.value}
                  className="flex flex-col space-y-1"
                >
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="bvn" />
                    </FormControl>
                    <FormLabel className="font-normal">
                      Bank Verification Number (BVN)
                    </FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="nin" />
                    </FormControl>
                    <FormLabel className="font-normal">
                      National Identification Number (NIN)
                    </FormLabel>
                  </FormItem>
                </RadioGroup>
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
                  <Input 
                    placeholder={field.value === "bvn" ? "Enter your 11-digit BVN" : "Enter your NIN"}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Your information is encrypted and secure.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Processing..." : "Create Account"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
};

export default IdFormDialog;
export { idFormSchema, type IdFormValues };
