import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";
import { CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react";
import BrandLoader from "@/components/ui/BrandLoader";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      icons={{
        success: <CheckCircle2 className="h-5 w-5 text-primary" />,
        error: <AlertCircle className="h-5 w-5 text-destructive" />,
        info: <Info className="h-5 w-5 text-primary" />,
        warning: <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
        loading: <BrandLoader variant="inline" size={24} showProgressBar={false} />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "cp-toast group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-xl",
          title: "text-sm font-semibold tracking-tight",
          description: "group-[.toast]:text-xs group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:rounded-lg group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:rounded-lg group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
