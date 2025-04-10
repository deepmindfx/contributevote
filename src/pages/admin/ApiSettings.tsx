
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Save, RefreshCw, Settings, Key, CheckCircle2, XCircle } from "lucide-react";
import { monnifyAPI } from "@/services/monnifyService";
import { Alert, AlertDescription } from "@/components/ui/alert";

const ApiSettings = () => {
  const [monnifyCredentials, setMonnifyCredentials] = useState({
    apiKey: "",
    secretKey: "",
    contractCode: "",
    baseUrl: ""
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [testingCredentials, setTestingCredentials] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean, message: string} | null>(null);
  
  // Load current credentials on mount
  useEffect(() => {
    const currentCredentials = monnifyAPI.getApiCredentials();
    setMonnifyCredentials({
      apiKey: currentCredentials.apiKey,
      secretKey: currentCredentials.secretKey,
      contractCode: currentCredentials.contractCode,
      baseUrl: currentCredentials.baseUrl
    });
  }, []);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setMonnifyCredentials(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleTestMonnifyCredentials = async () => {
    // Basic validation
    if (!monnifyCredentials.apiKey || !monnifyCredentials.secretKey || !monnifyCredentials.contractCode) {
      toast.error("Please fill in all required fields");
      return;
    }
    
    setTestingCredentials(true);
    setTestResult(null);
    
    try {
      const success = await monnifyAPI.testCredentials(monnifyCredentials);
      
      if (success) {
        setTestResult({
          success: true,
          message: "Authentication successful! The API credentials are valid."
        });
      } else {
        setTestResult({
          success: false,
          message: "Authentication failed. Please check your API credentials and try again."
        });
      }
    } catch (error) {
      console.error("Error testing Monnify credentials:", error);
      setTestResult({
        success: false,
        message: "An error occurred while testing the credentials. Please try again."
      });
    } finally {
      setTestingCredentials(false);
    }
  };
  
  const handleSaveMonnifyCredentials = async () => {
    setIsLoading(true);
    try {
      // Basic validation
      if (!monnifyCredentials.apiKey || !monnifyCredentials.secretKey || !monnifyCredentials.contractCode) {
        toast.error("Please fill in all required fields");
        return;
      }
      
      const success = monnifyAPI.updateCredentials(monnifyCredentials);
      
      if (success) {
        toast.success("Monnify API credentials updated successfully");
        
        // Reset test result when saving new credentials
        setTestResult(null);
      } else {
        toast.error("Failed to update Monnify API credentials");
      }
    } catch (error) {
      console.error("Error saving Monnify credentials:", error);
      toast.error("An error occurred while saving Monnify credentials");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Sidebar */}
        <div className="hidden md:flex w-64 flex-col fixed inset-y-0 z-50 border-r bg-card">
          <div className="p-6">
            <h2 className="text-2xl font-bold">CollectiPay</h2>
            <p className="text-sm text-muted-foreground">Admin Dashboard</p>
          </div>
          <nav className="flex-1 p-4 space-y-2">
            <Link to="/admin" className="flex items-center p-2 rounded-md hover:bg-muted">
              <Settings className="h-5 w-5 mr-3" />
              <span>Dashboard</span>
            </Link>
            <Link to="/admin/users" className="flex items-center p-2 rounded-md hover:bg-muted">
              <Settings className="h-5 w-5 mr-3" />
              <span>Users</span>
            </Link>
            <Link to="/admin/api-settings" className="flex items-center p-2 rounded-md bg-primary/10 text-primary hover:bg-primary/15">
              <Key className="h-5 w-5 mr-3" />
              <span>API Settings</span>
            </Link>
          </nav>
          <div className="p-4 border-t">
            <Button variant="outline" className="w-full mt-4" size="sm" asChild>
              <Link to="/dashboard">Switch to User View</Link>
            </Button>
          </div>
        </div>

        {/* Main content */}
        <main className="md:pl-64 flex-1">
          <div className="container max-w-6xl p-6">
            <div className="mb-6">
              <Button 
                variant="ghost" 
                size="sm" 
                className="mb-2"
                asChild
              >
                <Link to="/admin">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Link>
              </Button>
              <h1 className="text-3xl font-bold">API Settings</h1>
              <p className="text-muted-foreground">Manage payment provider API credentials</p>
            </div>

            <Tabs defaultValue="monnify">
              <TabsList className="mb-6">
                <TabsTrigger value="monnify">Monnify API</TabsTrigger>
                <TabsTrigger value="other" disabled>Other Providers</TabsTrigger>
              </TabsList>

              <TabsContent value="monnify">
                <Card>
                  <CardHeader>
                    <CardTitle>Monnify API Configuration</CardTitle>
                    <CardDescription>
                      Update your Monnify API credentials for virtual accounts and payments
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {testResult && (
                      <Alert variant={testResult.success ? "default" : "destructive"} className="mb-4">
                        {testResult.success ? (
                          <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 mr-2" />
                        )}
                        <AlertDescription>
                          {testResult.message}
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="apiKey">API Key</Label>
                          <Input 
                            id="apiKey"
                            name="apiKey"
                            value={monnifyCredentials.apiKey}
                            onChange={handleInputChange}
                            placeholder="Enter Monnify API Key"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="secretKey">Secret Key</Label>
                          <Input 
                            id="secretKey"
                            name="secretKey"
                            value={monnifyCredentials.secretKey}
                            onChange={handleInputChange}
                            type="password"
                            placeholder="Enter Monnify Secret Key"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="contractCode">Contract Code</Label>
                          <Input 
                            id="contractCode"
                            name="contractCode"
                            value={monnifyCredentials.contractCode}
                            onChange={handleInputChange}
                            placeholder="Enter Monnify Contract Code"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="baseUrl">Base URL</Label>
                          <Input 
                            id="baseUrl"
                            name="baseUrl"
                            value={monnifyCredentials.baseUrl}
                            onChange={handleInputChange}
                            placeholder="https://sandbox.monnify.com"
                          />
                          <p className="text-xs text-muted-foreground">
                            Use https://sandbox.monnify.com for testing or https://api.monnify.com for production
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="outline"
                        onClick={handleTestMonnifyCredentials}
                        disabled={testingCredentials || isLoading}
                      >
                        {testingCredentials ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Testing...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Test Connection
                          </>
                        )}
                      </Button>
                      
                      <Button 
                        onClick={handleSaveMonnifyCredentials}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ApiSettings;
