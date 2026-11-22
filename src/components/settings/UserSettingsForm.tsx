import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import BrandLoader from "@/components/ui/BrandLoader";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { supabase } from "@/integrations/supabase/client";
import { saveUserBvn } from "@/services/supabase/groupEnhancementService";
import { toast } from "sonner";
import {
  AtSign,
  Bell,
  Camera,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Moon,
  Phone,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  User,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const splitName = (fullName?: string | null) => {
  const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ") || "",
  };
};

const UserSettingsForm = () => {
  const { user, updateProfile, refreshCurrentUser } = useSupabaseUser();
  const [searchParams] = useSearchParams();

  const existingPrefs = (user?.preferences || {}) as Record<string, any>;
  const initialSplit = splitName(user?.name);

  const [userData, setUserData] = useState({
    firstName: initialSplit.firstName,
    lastName: initialSplit.lastName,
    email: user?.email || "",
    phone: user?.phone || "",
    username: existingPrefs.username || "",
    profileImage: existingPrefs.profileImage || "",
    pin: existingPrefs.transactionPin || "",
    preferences: {
      darkMode: Boolean(existingPrefs.darkMode),
      anonymousContributions: Boolean(existingPrefs.anonymousContributions),
      notificationsEnabled: existingPrefs.notificationsEnabled !== false,
    },
  });

  const [confirmPin, setConfirmPin] = useState(existingPrefs.transactionPin || "");
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Change password dialog state
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Inline BVN KYC verification state
  const [bvnInput, setBvnInput] = useState("");
  const [isVerifyingBvn, setIsVerifyingBvn] = useState(false);

  useEffect(() => {
    if (!user) return;
    const prefs = (user.preferences || {}) as Record<string, any>;
    const { firstName, lastName } = splitName(user.name);
    setUserData({
      firstName,
      lastName,
      email: user.email || "",
      phone: user.phone || "",
      username: prefs.username || "",
      profileImage: prefs.profileImage || "",
      pin: prefs.transactionPin || "",
      preferences: {
        darkMode: Boolean(prefs.darkMode),
        anonymousContributions: Boolean(prefs.anonymousContributions),
        notificationsEnabled: prefs.notificationsEnabled !== false,
      },
    });
    setConfirmPin(prefs.transactionPin || "");
  }, [user]);

  if (!user) return null;

  const hasSavedPin = /^\d{4}$/.test(String(existingPrefs.transactionPin || ""));
  const verifiedBvn = /^\d{11}$/.test(String(user.bvn || "").trim())
    ? String(user.bvn).trim()
    : null;

  const handleVerifyBvn = async () => {
    const clean = bvnInput.replace(/\D/g, "");
    if (clean.length !== 11) {
      toast.error("Please enter a valid 11-digit BVN");
      return;
    }
    setIsVerifyingBvn(true);
    try {
      const res = await saveUserBvn(clean);
      if (!res?.success) {
        toast.error(res?.error || "Could not verify BVN");
        return;
      }
      toast.success(`BVN ending in ${res.bvn_last4} verified for group creation & AML compliance`);
      setBvnInput("");
      await refreshCurrentUser();
    } catch (error: any) {
      toast.error(error?.message || "Failed to verify BVN");
    } finally {
      setIsVerifyingBvn(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUserData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePreferenceChange = (preference: string, value: boolean) => {
    if (preference === "darkMode") {
      document.documentElement.classList.toggle("dark", value);
    }
    setUserData((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [preference]: value,
      },
    }));
  };

  const handleProfileImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 512 * 1024) {
      toast.error("Image must be smaller than 500KB");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setPreviewImage(result);
      setUserData((prev) => ({ ...prev, profileImage: result }));
    };
    reader.readAsDataURL(file);
  };

  const handlePasswordChange = async () => {
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated successfully");
      setNewPassword("");
      setConfirmNewPassword("");
      setPasswordDialogOpen(false);
    } catch (error: any) {
      toast.error(error?.message || "Failed to update password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const currentPrefs = (user.preferences || {}) as Record<string, any>;
      const existingPin = currentPrefs.transactionPin || "";

      if (userData.pin && userData.pin !== existingPin) {
        if (!/^\d{4}$/.test(userData.pin)) {
          toast.error("Transaction PIN must be exactly 4 digits");
          return;
        }
        if (userData.pin !== confirmPin) {
          toast.error("PINs don't match");
          return;
        }
      }

      const fullName = `${userData.firstName} ${userData.lastName}`.trim();

      // IMPORTANT: Spread existingPrefs so virtualAccount and transactionPin are never overwritten!
      const mergedPreferences = {
        ...currentPrefs,
        darkMode: userData.preferences.darkMode,
        anonymousContributions: userData.preferences.anonymousContributions,
        notificationsEnabled: userData.preferences.notificationsEnabled,
        username: userData.username.trim(),
        profileImage: userData.profileImage,
        ...(userData.pin ? { transactionPin: userData.pin } : {}),
      };

      await updateProfile({
        name: fullName || user.name,
        phone: userData.phone.trim() || null,
        preferences: mergedPreferences,
      });

      toast.success("Settings saved");
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast.error(error?.message || "Failed to update settings");
    } finally {
      setIsLoading(false);
    }
  };

  const defaultTab =
    searchParams.get("tab") === "security"
      ? "security"
      : searchParams.get("tab") === "preferences"
      ? "preferences"
      : "profile";

  return (
    <>
      {(isLoading || isChangingPassword || isVerifyingBvn) && (
        <BrandLoader
          variant="overlay"
          message={
            isVerifyingBvn
              ? "Verifying your BVN"
              : isChangingPassword
              ? "Updating your password"
              : "Saving your settings"
          }
          submessage="Syncing your account securely with CollectiPay…"
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList
            className="app-segmented mb-6 grid w-full grid-cols-3 bg-muted/60 p-1"
            aria-label="Settings sections"
          >
            <TabsTrigger value="profile" className="gap-1.5">
              <User className="h-4 w-4" aria-hidden="true" />
              <span>Profile</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-1.5">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span>Security</span>
            </TabsTrigger>
            <TabsTrigger value="preferences" className="gap-1.5">
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              <span>Preferences</span>
            </TabsTrigger>
          </TabsList>

          {/* PROFILE TAB */}
          <TabsContent value="profile" className="space-y-5">
            <div className="cp-card-native overflow-hidden">
              <div className="border-b px-5 py-4">
                <h2 className="text-base font-bold text-foreground">Personal identity</h2>
                <p className="text-xs text-muted-foreground">
                  How group members see you when you pool funds and vote.
                </p>
              </div>

              <div className="space-y-6 p-5">
                {/* Avatar Uploader Row */}
                <div className="flex flex-col items-center gap-4 rounded-2xl border bg-muted/25 p-4 sm:flex-row">
                  <div className="relative shrink-0">
                    <Avatar className="h-20 w-20 border-2 border-primary/25 shadow-sm">
                      <AvatarImage src={previewImage || userData.profileImage} />
                      <AvatarFallback className="bg-accent text-xl font-bold text-primary">
                        {userData.firstName?.charAt(0)}
                        {userData.lastName?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <label
                      htmlFor="profile-image"
                      className="absolute -bottom-1 -right-1 grid h-8 w-8 cursor-pointer place-items-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-sm transition-transform hover:scale-105"
                      title="Upload profile photo"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      <input
                        type="file"
                        id="profile-image"
                        className="hidden"
                        accept="image/*"
                        onChange={handleProfileImage}
                      />
                    </label>
                  </div>
                  <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
                    <Label htmlFor="username" className="text-sm font-semibold">
                      CollectiPay Handle
                    </Label>
                    <div className="relative">
                      <AtSign className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="username"
                        name="username"
                        placeholder="choose-a-handle"
                        value={userData.username}
                        onChange={handleInputChange}
                        className="h-11 rounded-xl pl-10"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      JPG or PNG photo up to 500KB.
                    </p>
                  </div>
                </div>

                {/* Personal Inputs */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-sm font-semibold">
                      First name
                    </Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      placeholder="First Name"
                      value={userData.firstName}
                      onChange={handleInputChange}
                      className="h-11 rounded-xl"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-sm font-semibold">
                      Last name
                    </Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      placeholder="Last Name"
                      value={userData.lastName}
                      onChange={handleInputChange}
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="email" className="text-sm font-semibold">
                        Email address
                      </Label>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                        <Lock className="h-3 w-3" /> Verified
                      </span>
                    </div>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={userData.email}
                        disabled
                        className="h-11 rounded-xl bg-muted/60 pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-semibold">
                      Phone number
                    </Label>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="phone"
                        name="phone"
                        placeholder="+234 800 000 0000"
                        value={userData.phone}
                        onChange={handleInputChange}
                        className="h-11 rounded-xl pl-10"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* SECURITY TAB */}
          <TabsContent value="security" className="space-y-5">
            {/* Security Health Banner */}
            <div
              className={cn(
                "flex items-center gap-3.5 rounded-2xl border p-4",
                hasSavedPin
                  ? "border-primary/25 bg-accent/60"
                  : "border-amber-500/30 bg-amber-500/10"
              )}
            >
              <span
                className={cn(
                  "grid h-11 w-11 shrink-0 place-items-center rounded-xl",
                  hasSavedPin
                    ? "bg-primary text-primary-foreground"
                    : "bg-amber-500 text-white"
                )}
              >
                {hasSavedPin ? (
                  <ShieldCheck className="h-5 w-5" />
                ) : (
                  <ShieldAlert className="h-5 w-5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground">
                  {hasSavedPin ? "Wallet PIN protection is active" : "Set up your 4-digit Transaction PIN"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {hasSavedPin
                    ? "Your 4-digit PIN protects bank transfers, group contributions, withdrawals, and refund proposals."
                    : "Protect your wallet by adding a 4-digit PIN below — required for transfers, contributions, and withdrawals."}
                </p>
              </div>
            </div>

            {/* 4-Digit Native OTP PIN Card */}
            <div className="cp-card-native overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b px-5 py-4">
                <div>
                  <h2 className="text-base font-bold text-foreground">4-Digit Transaction PIN</h2>
                  <p className="text-xs text-muted-foreground">
                    Required to authorize bank transfers, wallet contributions, withdrawals &amp; refund proposals.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPin((v) => !v)}
                  className="h-9 gap-1.5 rounded-xl text-xs"
                >
                  {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showPin ? "Hide" : "Show"}
                </Button>
              </div>

              <div className="grid gap-6 p-5 sm:grid-cols-2">
                <div className="space-y-2.5">
                  <Label className="flex items-center gap-1.5 text-sm font-semibold">
                    <KeyRound className="h-4 w-4 text-primary" />
                    Enter 4-digit PIN
                  </Label>
                  <InputOTP
                    maxLength={4}
                    value={userData.pin}
                    onChange={(val) =>
                      setUserData((prev) => ({ ...prev, pin: val.replace(/\D/g, "").slice(0, 4) }))
                    }
                    inputMode="numeric"
                  >
                    <InputOTPGroup className="gap-2">
                      {[0, 1, 2, 3].map((idx) => (
                        <InputOTPSlot
                          key={idx}
                          index={idx}
                          className={cn(
                            "h-12 w-12 rounded-xl border text-lg font-bold",
                            !showPin && userData.pin[idx] && "text-transparent after:absolute after:h-2.5 after:w-2.5 after:rounded-full after:bg-foreground"
                          )}
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <div className="space-y-2.5">
                  <Label className="flex items-center gap-1.5 text-sm font-semibold">
                    <KeyRound className="h-4 w-4 text-primary" />
                    Confirm 4-digit PIN
                  </Label>
                  <InputOTP
                    maxLength={4}
                    value={confirmPin}
                    onChange={(val) => setConfirmPin(val.replace(/\D/g, "").slice(0, 4))}
                    inputMode="numeric"
                  >
                    <InputOTPGroup className="gap-2">
                      {[0, 1, 2, 3].map((idx) => (
                        <InputOTPSlot
                          key={idx}
                          index={idx}
                          className={cn(
                            "h-12 w-12 rounded-xl border text-lg font-bold",
                            !showPin && confirmPin[idx] && "text-transparent after:absolute after:h-2.5 after:w-2.5 after:rounded-full after:bg-foreground"
                          )}
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                  {userData.pin.length === 4 && confirmPin.length === 4 && (
                    <p
                      className={cn(
                        "text-xs font-semibold",
                        userData.pin === confirmPin ? "text-primary" : "text-destructive"
                      )}
                    >
                      {userData.pin === confirmPin ? "PINs match" : "PINs do not match"}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* BVN Identity Verification (KYC / AML) Card */}
            <div className="cp-card-native overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4">
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    BVN Identity Verification (KYC / AML)
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Required to create group pools and open dedicated Flutterwave deposit accounts.
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold",
                    verifiedBvn
                      ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                      : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                  )}
                >
                  {verifiedBvn ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                  {verifiedBvn ? `Verified · ***${verifiedBvn.slice(-4)}` : "Not Verified"}
                </span>
              </div>

              <div className="p-5">
                {verifiedBvn ? (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Your 11-digit BVN ending in{" "}
                    <strong className="font-mono text-foreground">{verifiedBvn.slice(-4)}</strong> is
                    verified and encrypted privately on your profile. Group creation and bank account
                    provisioning are fully unlocked.
                  </p>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1 space-y-1.5">
                      <Label htmlFor="settings-bvn" className="text-xs font-semibold">
                        Enter your 11-digit BVN
                      </Label>
                      <Input
                        id="settings-bvn"
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={11}
                        placeholder="12345678901"
                        value={bvnInput}
                        onChange={(e) => setBvnInput(e.target.value.replace(/\D/g, "").slice(0, 11))}
                        className="h-11 rounded-xl font-mono font-bold tracking-widest"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={handleVerifyBvn}
                      disabled={isVerifyingBvn || bvnInput.length !== 11}
                      className="h-11 rounded-xl font-semibold"
                    >
                      Verify BVN
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Password Card */}
            <div className="cp-card-native flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3.5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                  <Lock className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Account password</h3>
                  <p className="text-xs text-muted-foreground">
                    Use a strong unique password with at least 8 characters.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                type="button"
                onClick={() => setPasswordDialogOpen(true)}
                className="h-11 rounded-xl font-semibold"
              >
                Change password
              </Button>
            </div>
          </TabsContent>

          {/* PREFERENCES TAB */}
          <TabsContent value="preferences" className="space-y-5">
            {/* Visual Appearance Theme Picker */}
            <div className="cp-card-native overflow-hidden">
              <div className="border-b px-5 py-4">
                <h2 className="text-base font-bold text-foreground">Appearance</h2>
                <p className="text-xs text-muted-foreground">
                  Choose the visual theme that feels best on your device.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 p-5">
                {[
                  {
                    dark: false,
                    label: "Light Emerald",
                    desc: "Crisp daylight surface",
                    icon: Sun,
                    previewBg: "bg-[#f4f8f5] border-[#dce7e1]",
                    previewBar: "bg-[#075847]",
                    previewCard: "bg-white",
                  },
                  {
                    dark: true,
                    label: "Deep Forest Dark",
                    desc: "Low-glare night mode",
                    icon: Moon,
                    previewBg: "bg-[#111c19] border-[#243b34]",
                    previewBar: "bg-[#1b6d54]",
                    previewCard: "bg-[#192824]",
                  },
                ].map((theme) => {
                  const Icon = theme.icon;
                  const selected = userData.preferences.darkMode === theme.dark;
                  return (
                    <button
                      key={theme.label}
                      type="button"
                      data-selected={selected}
                      onClick={() => handlePreferenceChange("darkMode", theme.dark)}
                      className="cp-tile-option flex flex-col gap-3 p-3.5 text-left"
                    >
                      <div
                        className={cn(
                          "h-16 w-full overflow-hidden rounded-xl border p-2",
                          theme.previewBg
                        )}
                      >
                        <div className={cn("h-3 w-12 rounded-full", theme.previewBar)} />
                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                          <div className={cn("h-6 rounded-md", theme.previewCard)} />
                          <div className={cn("h-6 rounded-md", theme.previewCard)} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                            <Icon className="h-3.5 w-3.5 text-primary" />
                            {theme.label}
                          </span>
                          <span className="block text-[11px] text-muted-foreground">
                            {theme.desc}
                          </span>
                        </div>
                        {selected && (
                          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                            <Check className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Privacy & Notifications Toggles */}
            <div className="cp-card-native divide-y divide-border/70 overflow-hidden">
              <div className="flex items-center justify-between gap-4 p-5">
                <div className="flex items-start gap-3.5">
                  <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                    <UserCheck className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <Label className="text-sm font-bold">Anonymous Contributions</Label>
                    <p className="text-xs text-muted-foreground">
                      Mask your name by default on public group contributor feeds.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={userData.preferences.anonymousContributions}
                  onCheckedChange={(checked) =>
                    handlePreferenceChange("anonymousContributions", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between gap-4 p-5">
                <div className="flex items-start gap-3.5">
                  <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                    <Bell className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <Label className="text-sm font-bold">Activity &amp; Governance Alerts</Label>
                    <p className="text-xs text-muted-foreground">
                      Receive alerts for deposits, votes, invitations, and account updates.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={userData.preferences.notificationsEnabled}
                  onCheckedChange={(checked) =>
                    handlePreferenceChange("notificationsEnabled", checked)
                  }
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end">
          <Button
            type="submit"
            className="h-12 w-full rounded-xl font-semibold shadow-sm sm:w-auto sm:min-w-[13rem]"
            disabled={isLoading}
          >
            Save changes
          </Button>
        </div>
      </form>

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Update account password</DialogTitle>
            <DialogDescription>
              Enter a new password with at least 8 characters.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">Confirm new password</Label>
              <Input
                id="confirm-new-password"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="h-11 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setPasswordDialogOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handlePasswordChange}
              disabled={isChangingPassword}
              className="rounded-xl"
            >
              {isChangingPassword ? "Updating…" : "Update password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UserSettingsForm;
