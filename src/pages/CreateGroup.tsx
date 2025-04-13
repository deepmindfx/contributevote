
import { useState } from "react";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import GroupForm from "@/components/create-group/GroupForm";

const CreateGroup = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <Header />
      
      <main className="container max-w-3xl mx-auto px-4 pt-24 pb-12">
        <div className="mb-6 animate-fade-in">
          <Button 
            variant="ghost" 
            size="sm" 
            className="mb-2"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
          <h1 className="text-2xl font-bold">Create a New Group</h1>
          <p className="text-muted-foreground">Set up your contribution group in a few steps</p>
        </div>
        
        <GroupForm />
      </main>
      
      <MobileNav />
    </div>
  );
};

export default CreateGroup;
