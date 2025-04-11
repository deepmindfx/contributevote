
import React from "react";
import { Button } from "@/components/ui/button";

interface FilterButtonsProps {
  filter: "all" | "deposit" | "withdrawal" | "vote";
  setFilter: (filter: "all" | "deposit" | "withdrawal" | "vote") => void;
}

const FilterButtons = ({ filter, setFilter }: FilterButtonsProps) => {
  return (
    <div className="flex flex-wrap gap-2">
      <Button 
        variant={filter === "all" ? "default" : "outline"} 
        onClick={() => setFilter("all")}
        size="sm"
        className={filter === "all" ? "bg-[#2DAE75] hover:bg-[#249e69]" : ""}
      >
        All
      </Button>
      <Button 
        variant={filter === "deposit" ? "default" : "outline"} 
        onClick={() => setFilter("deposit")}
        size="sm"
        className={filter === "deposit" ? "bg-[#2DAE75] hover:bg-[#249e69]" : ""}
      >
        Deposits
      </Button>
      <Button 
        variant={filter === "withdrawal" ? "default" : "outline"} 
        onClick={() => setFilter("withdrawal")}
        size="sm"
        className={filter === "withdrawal" ? "bg-[#2DAE75] hover:bg-[#249e69]" : ""}
      >
        Withdrawals
      </Button>
      <Button 
        variant={filter === "vote" ? "default" : "outline"} 
        onClick={() => setFilter("vote")}
        size="sm"
        className={filter === "vote" ? "bg-[#2DAE75] hover:bg-[#249e69]" : ""}
      >
        Votes
      </Button>
    </div>
  );
};

export default FilterButtons;
