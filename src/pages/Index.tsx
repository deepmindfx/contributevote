import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Shield, Users, Vote, CreditCard, ArrowRight, Lock, Wifi, Wallet, Home, Plus, User as UserIcon } from "lucide-react";

// Phone Mockup Component - CollectiPay Dashboard
const PhoneMockup = () => {
  return (
    <div className="relative w-full max-w-xs mx-auto">
      {/* Phone */}
      <div className="relative z-10 w-[280px] h-[570px] bg-gray-800 rounded-[40px] p-2.5 shadow-2xl mx-auto border-4 border-gray-700">
        <div className="w-full h-full bg-gradient-to-br from-blue-50 to-indigo-100 rounded-[30px] overflow-hidden relative">
          {/* Dynamic Island */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-20"></div>
          
          {/* Screen Content - CollectiPay Dashboard */}
          <div className="h-full flex flex-col pt-8 overflow-hidden">
            {/* Header */}
            <div className="px-3 py-2 bg-white shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                    <CreditCard className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-xs font-bold">CollectiPay</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-5 h-5 rounded-full bg-gray-200"></div>
                </div>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 pb-16">
              {/* Wallet Card */}
              <div className="bg-gradient-to-br from-primary to-primary/80 rounded-xl p-3 text-white shadow-lg">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-[10px] opacity-80">Wallet Balance</p>
                    <p className="text-xl font-bold">₦25,000</p>
                  </div>
                  <Wallet className="w-4 h-4 opacity-80" />
                </div>
                <div className="flex gap-1.5 mt-3">
                  <button className="flex-1 bg-white/20 hover:bg-white/30 rounded-lg py-1.5 text-[9px] font-medium">
                    Deposit
                  </button>
                  <button className="flex-1 bg-white/20 hover:bg-white/30 rounded-lg py-1.5 text-[9px] font-medium">
                    Withdraw
                  </button>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white rounded-lg p-2 text-center shadow-sm">
                  <div className="w-6 h-6 bg-primary/10 rounded-full mx-auto mb-1 flex items-center justify-center">
                    <Plus className="w-3 h-3 text-primary" />
                  </div>
                  <p className="text-[8px] font-medium">Create</p>
                </div>
                <div className="bg-white rounded-lg p-2 text-center shadow-sm">
                  <div className="w-6 h-6 bg-primary/10 rounded-full mx-auto mb-1 flex items-center justify-center">
                    <Users className="w-3 h-3 text-primary" />
                  </div>
                  <p className="text-[8px] font-medium">Groups</p>
                </div>
                <div className="bg-white rounded-lg p-2 text-center shadow-sm">
                  <div className="w-6 h-6 bg-primary/10 rounded-full mx-auto mb-1 flex items-center justify-center">
                    <Vote className="w-3 h-3 text-primary" />
                  </div>
                  <p className="text-[8px] font-medium">Votes</p>
                </div>
              </div>

              {/* My Groups */}
              <div>
                <h3 className="text-xs font-bold mb-2 text-gray-700">My Groups</h3>
                <div className="space-y-2">
                  <div className="bg-white rounded-lg p-2.5 shadow-sm">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <p className="text-[10px] font-semibold">Wedding Savings</p>
                        <p className="text-[8px] text-gray-500">5 members</p>
                      </div>
                      <span className="text-[8px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Active</span>
                    </div>
                    <div className="mt-2">
                      <div className="flex justify-between text-[8px] mb-1">
                        <span className="text-gray-500">Progress</span>
                        <span className="font-medium">₦45k / ₦100k</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1">
                        <div className="bg-primary h-1 rounded-full" style={{width: '45%'}}></div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-2.5 shadow-sm">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <p className="text-[10px] font-semibold">Business Fund</p>
                        <p className="text-[8px] text-gray-500">3 members</p>
                      </div>
                      <span className="text-[8px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Active</span>
                    </div>
                    <div className="mt-2">
                      <div className="flex justify-between text-[8px] mb-1">
                        <span className="text-gray-500">Progress</span>
                        <span className="font-medium">₦30k / ₦50k</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1">
                        <div className="bg-primary h-1 rounded-full" style={{width: '60%'}}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Navigation - Fixed at bottom */}
            <div className="absolute bottom-0 left-0 right-0 bg-white border-t px-4 py-2.5 rounded-b-[30px]">
              <div className="flex justify-around items-center">
                <Home className="w-5 h-5 text-primary" />
                <Users className="w-5 h-5 text-gray-400" />
                <Plus className="w-5 h-5 text-gray-400" />
                <Vote className="w-5 h-5 text-gray-400" />
                <UserIcon className="w-5 h-5 text-gray-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card */}
      <div className="absolute bottom-10 -left-12 sm:-left-20 z-20 w-56 h-36 bg-gradient-to-br from-teal-500 to-green-800 rounded-xl p-4 shadow-2xl transform -rotate-12 flex flex-col justify-between relative overflow-hidden">
        {/* Coming Soon Badge - Diagonal */}
        <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 bg-lime-400 text-black text-xs font-bold py-1.5 text-center shadow-lg transform rotate-12">
          COMING SOON
        </div>
        <div>
          <div className="flex justify-between items-start">
            <span className="text-white text-lg font-bold">CollectiPay</span>
            <svg className="w-8 h-8" viewBox="0 0 40 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M35.666 0H4.332C1.94 0 0 1.94 0 4.333v19.333C0 26.06 1.94 28 4.332 28h31.334C38.06 28 40 26.06 40 23.666V4.333C40 1.94 38.06 0 35.666 0Z" fill="#D8D8D8"></path>
              <path d="M11.667 14h16.666M20 5.833v16.667M25.833 2.5v7.5M25.833 18v7.5M14.167 2.5v7.5M14.167 18v7.5M30 10V5.833M30 22.167V18M10 10V5.833M10 22.167V18" stroke="#AE8B36" strokeWidth="2.5"></path>
            </svg>
          </div>
          <p className="text-white text-xs mt-1">OneCard</p>
        </div>
        <div className="flex justify-between items-end">
          <Wifi className="w-5 h-5 text-white" />
          <svg className="h-4" viewBox="0 0 38 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M25.756 11.372h-2.132c-.395 0-.584-.23-.68-.532l-3.32-9.613h2.698l1.458 5.17c.106.347.19.723.284.992.085-.29.17-.655.284-.992l1.448-5.17h2.533l-3.553 10.145Z" fill="white"></path>
          </svg>
        </div>
      </div>

      {/* Background Card */}
      <div className="absolute bottom-5 -right-12 sm:-right-20 z-0 w-56 h-36 bg-lime-300 rounded-xl p-4 shadow-lg transform rotate-12">
        <span className="text-black text-4xl font-black absolute bottom-4 right-4">App</span>
      </div>
    </div>
  );
};

const Index = () => {
  const features = [
    {
      icon: <Users className="h-6 w-6 text-lime-400" />,
      title: "Group Contributions",
      description: "Create or join contribution groups for any purpose - business, events, savings, or donations."
    },
    {
      icon: <Vote className="h-6 w-6 text-lime-400" />,
      title: "Vote-Based Withdrawals",
      description: "All fund withdrawals require group approval through a transparent voting system."
    },
    {
      icon: <CreditCard className="h-6 w-6 text-lime-400" />,
      title: "Secure Payments",
      description: "Multiple payment options with bank-grade security for all transactions."
    },
    {
      icon: <Shield className="h-6 w-6 text-lime-400" />,
      title: "Fraud Prevention",
      description: "Advanced security features to protect contributions and ensure transparency."
    }
  ];

  return (
    <div className="min-h-screen bg-[#001a33] bg-[radial-gradient(circle_at_70%_10%,#115e59_0%,#001a33_40%)] text-white">
      {/* Header */}
      <header className="py-6 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-7xl flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-lime-400 p-1.5 text-black">
              <CreditCard className="h-5 w-5" />
            </div>
            <span className="text-2xl font-bold tracking-tight">CollectiPay</span>
          </div>
          <nav className="hidden lg:flex items-center gap-8">
            <a href="#features" className="text-gray-300 hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="text-gray-300 hover:text-white transition-colors">How It Works</a>
            <Link to="/auth" className="text-gray-300 hover:text-white transition-colors">Help</Link>
          </nav>
          <Link to="/auth">
            <button className="border border-gray-500 rounded-full px-6 py-2 text-sm font-medium text-white hover:bg-white/10 hover:border-white transition-all">
              Sign In
            </button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left Side */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-white/10 text-xs font-medium px-4 py-1.5 rounded-full mb-6">
              <Lock className="w-4 h-4 text-lime-300" />
              100% TRUSTED PLATFORM
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tighter">
              Secure Group Savings with
              <span className="text-lime-300 block">Democratic Control</span>
            </h1>
            <p className="mt-6 text-lg text-gray-300 max-w-lg mx-auto lg:mx-0">
              Create contribution groups where funds can only be withdrawn with member approval. 
              Perfect for thrift savings, event funding, and community projects.
            </p>
            <Link to="/auth">
              <button className="mt-10 inline-flex items-center gap-3 bg-lime-400 text-black font-bold text-lg px-8 py-4 rounded-full group transition-all hover:bg-lime-300">
                Open Account
                <div className="bg-white p-2 rounded-full group-hover:translate-x-1 transition-transform">
                  <ArrowRight className="w-5 h-5" />
                </div>
              </button>
            </Link>
          </div>

          {/* Right Side - Phone Mockup */}
          <div className="relative h-[500px] flex items-center justify-center">
            <PhoneMockup />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 md:px-6 bg-teal-900/30">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Key Features</h2>
            <p className="text-gray-300 max-w-2xl mx-auto">
              CollectiPay combines the best of traditional contribution systems with modern technology
              for security and transparency.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="bg-[#0d2a44] border-teal-800/50 hover:border-lime-400/50 transition-all">
                <CardContent className="pt-6">
                  <div className="flex flex-col items-start">
                    <div className="rounded-full bg-lime-400/10 p-3 mb-4">
                      {feature.icon}
                    </div>
                    <h3 className="text-xl font-semibold mb-2 text-white">{feature.title}</h3>
                    <p className="text-gray-300">{feature.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-4 md:px-6">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-gray-300 max-w-2xl mx-auto">
              CollectiPay makes group contributions simple, transparent, and secure.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-lime-400 text-black flex items-center justify-center text-xl font-bold mb-4">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">Create a Group</h3>
              <p className="text-gray-300">
                Start a group for your purpose - wedding, business, family, or community project.
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-lime-400 text-black flex items-center justify-center text-xl font-bold mb-4">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">Invite Contributors</h3>
              <p className="text-gray-300">
                Add members via email, phone number, or shareable invite links.
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-lime-400 text-black flex items-center justify-center text-xl font-bold mb-4">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">Secure Withdrawals</h3>
              <p className="text-gray-300">
                Funds are released only after group approval through transparent voting.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 md:px-6 bg-gradient-to-r from-teal-600 to-lime-500">
        <div className="container mx-auto max-w-7xl text-center">
          <h2 className="text-3xl font-bold mb-4 text-white">Ready to Start Collective Savings?</h2>
          <p className="max-w-2xl mx-auto mb-8 text-white/90">
            Join thousands of users already managing their group contributions securely with CollectiPay.
          </p>
          <Button size="lg" className="bg-white hover:bg-gray-100 text-black font-bold" asChild>
            <Link to="/auth">Create Your First Group</Link>
          </Button>
        </div>
      </section>

      {/* Partners Footer */}
      <footer className="bg-teal-900/50 py-8">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 text-center">
            <p className="text-gray-400 text-sm mb-4">Trusted Payment Partners</p>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12 mb-8">
            <img 
              src="/Partners/Flutterwave_Logo.png" 
              alt="Flutterwave" 
              className="h-8 md:h-10 object-contain opacity-60 hover:opacity-80 transition-all"
              style={{ filter: 'brightness(0) invert(1) opacity(0.6)' }}
            />
            <img 
              src="/Partners/Stripe_Logo,_revised_2016.svg.png" 
              alt="Stripe" 
              className="h-8 md:h-10 object-contain opacity-60 hover:opacity-80 transition-all"
              style={{ filter: 'brightness(0) invert(1) opacity(0.6)' }}
            />
            <img 
              src="/Partners/Sterling_Bank_Logo_Straight.png" 
              alt="Sterling Bank" 
              className="h-8 md:h-10 object-contain opacity-60 hover:opacity-80 transition-all"
              style={{ filter: 'brightness(0) invert(1) opacity(0.6)' }}
            />
            <img 
              src="/Partners/Wema-Bank-Logo.png" 
              alt="Wema Bank" 
              className="h-8 md:h-10 object-contain opacity-60 hover:opacity-80 transition-all"
              style={{ filter: 'brightness(0) invert(1) opacity(0.6)' }}
            />
          </div>
          
          <div className="border-t border-white/10 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="flex items-center space-x-2 mb-4 md:mb-0">
                <div className="rounded-full bg-lime-400 p-1.5 text-black">
                  <CreditCard className="h-5 w-5" />
                </div>
                <span className="text-xl font-bold">CollectiPay</span>
              </div>
              <div className="flex space-x-6">
                <Link to="#" className="text-gray-400 hover:text-white">
                  Terms
                </Link>
                <Link to="#" className="text-gray-400 hover:text-white">
                  Privacy
                </Link>
                <Link to="#" className="text-gray-400 hover:text-white">
                  Contact
                </Link>
              </div>
            </div>
            <div className="mt-8 text-center text-gray-400 text-sm">
              © {new Date().getFullYear()} CollectiPay. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
