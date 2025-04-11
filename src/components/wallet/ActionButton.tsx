
import React from "react";
import { Button } from "@/components/ui/button";
import { DialogTrigger } from "@/components/ui/dialog";

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  isDialogTrigger?: boolean;
}

const ActionButton = ({ icon, label, onClick, isDialogTrigger = false }: ActionButtonProps) => {
  const buttonContent = (
    <div className="flex flex-col items-center justify-center p-3 hover:bg-muted/50 cursor-pointer rounded-lg transition-colors">
      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-[#2DAE75] mb-1">
        {icon}
      </div>
      <span className="text-xs">{label}</span>
    </div>
  );

  if (isDialogTrigger) {
    return <DialogTrigger asChild>{buttonContent}</DialogTrigger>;
  }

  return (
    <div onClick={onClick}>
      {buttonContent}
    </div>
  );
};

export default ActionButton;
