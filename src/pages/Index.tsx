import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import Header from "@/components/layout/Header";
import { Shield, Users, Vote, CreditCard } from "lucide-react";

const Index = () => {
  const features = [
    {
      icon: <Users className="h-6 w-6 text-primary" />,
      title: "Group Contributions",
      description: "Create or join contribution groups for any purpose - business, events, savings, or donations."
    },
    {
      icon: <Vote className="h-6 w-6 text-primary" />,
      title: "Vote-Based Withdrawals",
      description: "All fund withdrawals require group approval through a transparent voting system."
    },
    {
      icon: <CreditCard className="h-6 w-6 text-primary" />,
      title: "Secure Payments",
      description: "Multiple payment options with bank-grade security for all transactions."
    },
    {
      icon: <Shield className="h-6 w-6 text-primary" />,
      title: "Fraud Prevention",
      description: "Advanced security features to protect contributions and ensure transparency."
    }
  ];

  return (
    <div className="min-h-screen">
      <Header />
      
      {/* Hero Section */}
      <section className="pt-32 pb-16 px-4 md:px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="flex flex-col items-center text-center space-y-6 animate-fade-in">
            <div className="inline-block bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium mb-2">
              Introducing CollectiPay
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight max-w-2xl">
              Secure Group Savings with Democratic Control
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Create contribution groups where funds can only be withdrawn with member approval. 
              Perfect for thrift savings, event funding, and community projects.
            </p>
            <p className="text-sm text-muted-foreground">
              Developed by Traceroot Technology Solutions
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button size="lg" asChild className="animate-slide-up animation-delay-200">
                <Link to="/auth">Get Started</Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="animate-slide-up animation-delay-400">
                <Link to="#features">Learn More</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 md:px-6 bg-secondary/50">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-3xl font-bold mb-4">Key Features</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              CollectiPay combines the best of traditional contribution systems with modern technology
              for security and transparency.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="glass-card animate-scale animation-delay-200 border-0">
                <CardContent className="pt-6">
                  <div className="flex flex-col items-start">
                    <div className="rounded-full bg-primary/10 p-3 mb-4">
                      {feature.icon}
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 md:px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              CollectiPay makes group contributions simple, transparent, and secure.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center animate-slide-up">
              <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center text-xl font-bold mb-4">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">Create a Group</h3>
              <p className="text-muted-foreground">
                Start a group for your purpose - wedding, business, family, or community project.
              </p>
            </div>
            <div className="flex flex-col items-center text-center animate-slide-up animation-delay-200">
              <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center text-xl font-bold mb-4">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">Invite Contributors</h3>
              <p className="text-muted-foreground">
                Add members via email, phone number, or shareable invite links.
              </p>
            </div>
            <div className="flex flex-col items-center text-center animate-slide-up animation-delay-400">
              <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center text-xl font-bold mb-4">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">Secure Withdrawals</h3>
              <p className="text-muted-foreground">
                Funds are released only after group approval through transparent voting.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 md:px-6 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-5xl text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Start Collective Savings?</h2>
          <p className="max-w-2xl mx-auto mb-8 text-primary-foreground/80">
            Join thousands of users already managing their group contributions securely with CollectiPay.
          </p>
          <Button size="lg" variant="outline" className="bg-white hover:bg-white/90 text-primary hover:text-primary" asChild>
            <Link to="/auth">Create Your First Group</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 md:px-6 border-t">
        <div className="container mx-auto max-w-5xl">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="rounded-full bg-primary p-1.5 text-primary-foreground">
                <CreditCard className="h-5 w-5" />
              </div>
              <span className="text-xl font-bold">CollectiPay</span>
            </div>
            <div className="flex space-x-6">
              <Link to="#" className="text-muted-foreground hover:text-foreground">
                Terms
              </Link>
              <Link to="#" className="text-muted-foreground hover:text-foreground">
                Privacy
              </Link>
              <Link to="#" className="text-muted-foreground hover:text-foreground">
                Contact
              </Link>
            </div>
          </div>
          <div className="mt-8 text-center text-muted-foreground text-sm">
            © {new Date().getFullYear()} CollectiPay. All rights reserved.
            <br />
            Developed by Traceroot Technology Solutions
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
