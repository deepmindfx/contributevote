
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; 
import { CheckCircle, Copy, Link, Share2, User, UserPlus, Mail, Phone } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";

interface ShareContributionProps {
  contributionId: string;
  contributionName: string;
}

const ShareContribution = ({ contributionId, contributionName }: ShareContributionProps) => {
  const { getShareLink, users, user, shareToContacts } = useApp();
  const [copied, setCopied] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [activeTab, setActiveTab] = useState("contacts");
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  
  // Filter out current user from contacts list
  const contacts = users.filter(u => u.id !== user.id);
  
  const shareUrl = `${window.location.origin}/contribute/share/${contributionId}`;
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopied(false), 3000);
  };
  
  const toggleSelectContact = (userId: string) => {
    if (selectedContacts.includes(userId)) {
      setSelectedContacts(selectedContacts.filter(id => id !== userId));
    } else {
      setSelectedContacts([...selectedContacts, userId]);
    }
  };
  
  const handleShareToContacts = () => {
    if (activeTab === "contacts" && selectedContacts.length === 0) {
      toast.error("Please select at least one contact");
      return;
    }
    
    if (activeTab === "manual" && !recipientEmail && !recipientPhone) {
      toast.error("Please enter an email or phone number");
      return;
    }
    
    const recipients = activeTab === "contacts" 
      ? [...selectedContacts] 
      : [];
    
    if (activeTab === "manual") {
      if (recipientEmail) {
        recipients.push(recipientEmail);
      }
      
      if (recipientPhone) {
        recipients.push(recipientPhone);
      }
    }
    
    shareToContacts(contributionId, recipients);
    
    // Reset form
    setSelectedContacts([]);
    setRecipientEmail("");
    setRecipientPhone("");
    setIsOpen(false);
    
    toast.success(`Link shared with ${recipients.length} recipient(s)`);
  };
  
  const handlePreview = () => {
    navigate(`/contribute/share/${contributionId}`);
    setIsOpen(false);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Share2 className="h-4 w-4" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share contribution</DialogTitle>
          <DialogDescription>
            Invite others to contribute to "{contributionName}"
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex items-center space-x-2 mt-4">
          <div className="grid flex-1 gap-2">
            <Label htmlFor="link" className="sr-only">Link</Label>
            <Input
              id="link"
              value={shareUrl}
              readOnly
              className="w-full"
            />
          </div>
          <Button 
            type="button" 
            size="sm" 
            className="px-3" 
            onClick={copyToClipboard}
          >
            {copied ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        <div className="mt-4 space-y-4">
          <Tabs defaultValue="contacts" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-2 mb-2">
              <TabsTrigger value="contacts">
                <UserPlus className="h-4 w-4 mr-2" />
                Contacts
              </TabsTrigger>
              <TabsTrigger value="manual">
                <Mail className="h-4 w-4 mr-2" />
                Manual Entry
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="contacts">
              <div>
                <Label className="text-base mb-2 block">Share with contacts</Label>
                {contacts.length > 0 ? (
                  <ScrollArea className="h-[200px] border rounded-md p-2">
                    <div className="space-y-2">
                      {contacts.map(contact => (
                        <div 
                          key={contact.id} 
                          className="flex items-center space-x-2 py-1 px-2 hover:bg-accent hover:text-accent-foreground rounded-md cursor-pointer"
                          onClick={() => toggleSelectContact(contact.id)}
                        >
                          <Checkbox 
                            checked={selectedContacts.includes(contact.id)} 
                            onCheckedChange={() => toggleSelectContact(contact.id)}
                          />
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={contact.profileImage || ""} alt={contact.name} />
                            <AvatarFallback>
                              {contact.firstName?.charAt(0)}{contact.lastName?.charAt(0) || ""}
                            </AvatarFallback>
                          </Avatar>
                          <div className="text-sm">
                            <p className="font-medium">{contact.name}</p>
                            <p className="text-xs text-muted-foreground">{contact.email || contact.phoneNumber}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center border rounded-md">
                    <User className="h-10 w-10 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No contacts available</p>
                    <p className="text-xs text-muted-foreground mt-1">Try using manual entry instead</p>
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="manual">
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="email" className="flex items-center">
                    <Mail className="h-4 w-4 mr-2" />
                    Share via email
                  </Label>
                  <div className="relative">
                    <Input 
                      id="email" 
                      placeholder="Enter email address" 
                      type="email" 
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="phone" className="flex items-center">
                    <Phone className="h-4 w-4 mr-2" />
                    Share via phone number
                  </Label>
                  <div className="relative">
                    <Input 
                      id="phone" 
                      placeholder="Enter phone number" 
                      type="tel" 
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your recipient will be added to the group and gain voting rights after contributing
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
        
        <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
          <Button variant="outline" type="button" onClick={copyToClipboard}>
            <Link className="mr-2 h-4 w-4" />
            Copy Link
          </Button>
          <Button variant="outline" type="button" onClick={handlePreview}>
            <User className="mr-2 h-4 w-4" />
            Preview Link
          </Button>
          <Button type="button" onClick={handleShareToContacts}>
            <Share2 className="mr-2 h-4 w-4" />
            Share Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ShareContribution;
