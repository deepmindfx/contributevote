
import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  // Create a safe version of the selected prop
  const safeProps = { ...props };
  
  // Handle conversion of selected dates if needed
  if (safeProps.selected !== undefined && typeof safeProps.selected !== 'undefined') {
    // Handle single date
    if (safeProps.mode === 'single' && !Array.isArray(safeProps.selected) && safeProps.selected !== null) {
      if (typeof safeProps.selected === 'string' || typeof safeProps.selected === 'number') {
        safeProps.selected = new Date(safeProps.selected);
      }
    }
    // Handle multiple dates
    else if (safeProps.mode === 'multiple' && Array.isArray(safeProps.selected)) {
      safeProps.selected = safeProps.selected.map(date => 
        typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
      );
    }
    // Handle range
    else if (safeProps.mode === 'range' && safeProps.selected !== null && typeof safeProps.selected === 'object') {
      const range = safeProps.selected as any;
      const typedRange = {
        from: undefined as Date | undefined,
        to: undefined as Date | undefined
      };
      
      if (range.from) {
        typedRange.from = typeof range.from === 'string' || typeof range.from === 'number' 
          ? new Date(range.from) 
          : range.from;
      }
      
      if (range.to) {
        typedRange.to = typeof range.to === 'string' || typeof range.to === 'number'
          ? new Date(range.to)
          : range.to;
      }
      
      safeProps.selected = typedRange;
    }
  }

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ...props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ...props }) => <ChevronRight className="h-4 w-4" />,
      }}
      {...safeProps}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
