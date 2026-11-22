import { useState, useEffect, useRef } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { PasswordRequirements } from "@/components/auth/PasswordRequirements";
import { meetsPasswordRequirements, PASSWORD_MIN_LENGTH, passwordIssue } from "@/lib/passwordPolicy";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DeviceNotificationSettings } from "./DeviceNotificationSettings";
import { paymentVibrationEnabled } from "@/services/supabase/notificationService";
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
import { hasTransactionPin } from "@/lib/transactionPin";
import { compressProfileImage, formatByteSize } from "@/lib/imageCompression";
import { cn } from "@/lib/utils";
import { applyAppearance, usesDarkMode } from "@/lib/appearance";

const splitName = (fullName?: string | null) => {
  const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ") || "",
  };
};

type SettingsTab = "profile" | "security" | "preferences";

const resolveSettingsTab = (tab: string | null): SettingsTab =>
  tab === "security" ? "security" : tab === "preferences" ? "preferences" : "profile";

const UserSettingsForm = () => {
  const { user, updateProfile, refreshCurrentUser } = useSupabaseUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => resolveSettingsTab(searchParams.get("tab")));
  const dirtyRef = useRef(false);
  const syncedUserIdRef = useRef<string | null>(user?.id ?? null);

  const existingPrefs = (user?.preferences || {}) as Record<string, any>;
  const initialSplit = splitName(user?.name);

  const [userData, setUserData] = useState({
    firstName: initialSplit.firstName,
    lastName: initialSplit.lastName,
    email: user?.email || "",
    phone: user?.phone || "",
    username: existingPrefs.username || "",
    profileImage: existingPrefs.profileImage || "",
    preferences: {
      darkMode: usesDarkMode(existingPrefs),
      anonymousContributions: Boolean(existingPrefs.anonymousContributions),
      notificationsEnabled: existingPrefs.notificationsEnabled !== false,
      walletNotifications: existingPrefs.walletNotifications !== false,
      groupNotifications: existingPrefs.groupNotifications !== false,
      paymentVibration: paymentVibrationEnabled(existingPrefs),
    },
  });

  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const [photoCompressionMeta, setPhotoCompressionMeta] = useState<string | null>(null);
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
    const requestedTab = resolveSettingsTab(searchParams.get("tab"));
    setActiveTab((current) => (current === requestedTab ? current : requestedTab));
  }, [searchParams]);

  useEffect(() => {
    if (location.hash !== "#device-notifications") return;
    if (activeTab !== "preferences") {
      setActiveTab("preferences");
      return;
    }
    const frame = requestAnimationFrame(() => {
      document.getElementById("device-notifications")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [location.hash, activeTab]);

  useEffect(() => {
    if (!user) return;
    const switchedUser = syncedUserIdRef.current !== user.id;
    if (switchedUser) {
      syncedUserIdRef.current = user.id;
      dirtyRef.current = false;
      setPreviewImage(null);
    } else if (dirtyRef.current) {
      // Preserve unsaved form edits when realtime updates refresh the profile row (e.g. incoming deposit).
      return;
    }
    const prefs = (user.preferences || {}) as Record<string, any>;
    const { firstName, lastName } = splitName(user.name);
    setUserData({
      firstName,
      lastName,
      email: user.email || "",
      phone: user.phone || "",
      username: prefs.username || "",
      profileImage: prefs.profileImage || "",
      preferences: {
        darkMode: usesDarkMode(prefs),
        anonymousContributions: Boolean(prefs.anonymousContributions),
        notificationsEnabled: prefs.notificationsEnabled !== false,
        walletNotifications: prefs.walletNotifications !== false,
        groupNotifications: prefs.groupNotifications !== false,
        paymentVibration: paymentVibrationEnabled(prefs),
      },
    });
  }, [user?.id, user?.name, user?.email, user?.phone, user?.preferences]);

  if (!user) return null;

  const hasSavedPin = hasTransactionPin(existingPrefs);
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
    dirtyRef.current = true;
    setUserData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePreferenceChange = (preference: string, value: boolean) => {
    dirtyRef.current = true;
    if (preference === "darkMode") {
      applyAppearance(value);
    }
    setUserData((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [preference]: value,
      },
    }));
  };

  const handleProfileImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressingPhoto(true);
    try {
      const compressed = await compressProfileImage(file, {
        maxInputBytes: 5 * 1024 * 1024, // Up to 5 MB source photo
        maxDimension: 640, // 640x640 Retina HD
        targetMaxBytes: 180 * 1024,
      });

      dirtyRef.current = true;
      setPreviewImage(compressed.dataUrl);
      setUserData((prev) => ({ ...prev, profileImage: compressed.dataUrl }));

      if (compressed.originalBytes > compressed.compressedBytes) {
        const summary = `Optimized ${formatByteSize(compressed.originalBytes)} → ${formatByteSize(compressed.compressedBytes)} (HD)`;
        setPhotoCompressionMeta(summary);
        toast.success(`Photo ready (${summary})`);
      } else {
        setPhotoCompressionMeta(`${formatByteSize(compressed.compressedBytes)} (HD)`);
      }
    } catch (error: any) {
      toast.error(error?.message || "Could not process the selected photo.");
    } finally {
      setIsCompressingPhoto(false);
      e.target.value = "";
    }
  };

  const handlePasswordChange = async () => {
    const issue = passwordIssue(newPassword);
    if (issue) {
      toast.error(issue);
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

  async function savePin() {
    if (isSavingPin || newPin.length !== 4 || newPin !== confirmPin || (hasSavedPin && currentPin.length !== 4)) return;
    setIsSavingPin(true);
    try {
      const { data, error } = await supabase.rpc("set_user_transaction_pin", {
        p_new_pin: newPin,
        p_current_pin: hasSavedPin ? currentPin : undefined,
      });
      const result = data as { success?: boolean; error?: string } | null;
      if (error || !result?.success) throw new Error(result?.error || error?.message || "Couldn’t save your PIN.");
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      toast.success(hasSavedPin ? "Transaction PIN changed." : "Transaction PIN set.");
      await refreshCurrentUser();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t save your PIN.");
    } finally {
      setIsSavingPin(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const currentPrefs = (user.preferences || {}) as Record<string, any>;
      const fullName = `${userData.firstName} ${userData.lastName}`.trim();

      // IMPORTANT: Spread existingPrefs so virtualAccount and transactionPin are never overwritten!
      const mergedPreferences = {
        ...currentPrefs,
        darkMode: userData.preferences.darkMode,
        anonymousContributions: userData.preferences.anonymousContributions,
        notificationsEnabled: userData.preferences.notificationsEnabled,
        walletNotifications: userData.preferences.walletNotifications,
        groupNotifications: userData.preferences.groupNotifications,
        paymentVibration: userData.preferences.paymentVibration,
        username: userData.username.trim(),
        profileImage: userData.profileImage,
      };

      await updateProfile({
        name: fullName || user.name,
        phone: userData.phone.trim() || null,
        preferences: mergedPreferences,
      });

      dirtyRef.current = false;
      setPreviewImage(null);
      setPhotoCompressionMeta(null);
      toast.success("Settings saved");
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast.error(error?.message || "Failed to update settings");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabChange = (next: string) => {
    const tab = resolveSettingsTab(next);
    setActiveTab(tab);
    const updated = new URLSearchParams(searchParams);
    if (tab === "profile") updated.delete("tab");
    else updated.set("tab", tab);
    setSearchParams(updated, { replace: true });
  };

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
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
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
                      {isCompressingPhoto
                        ? "Optimizing photo with lossless HD compression…"
                        : photoCompressionMeta
                        ? `Ready to save · ${photoCompressionMeta}`
                        : "JPG, PNG, or WebP up to 5MB (auto-compressed to lossless HD)."}
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

            <div className="cp-card-native space-y-4 p-4 sm:p-5">
              <div>
                <h2 className="text-base font-bold">Transaction PIN</h2>
                <p className="text-xs text-muted-foreground">Use this PIN when sending money, contributing or withdrawing.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ...(hasSavedPin ? [{ id: "current-pin", label: "Current PIN", value: currentPin, update: setCurrentPin }] : []),
                  { id: "new-pin", label: "New PIN", value: newPin, update: setNewPin },
                  { id: "confirm-pin", label: "Confirm PIN", value: confirmPin, update: setConfirmPin },
                ].map(({ id, label, value, update }) => (
                  <div key={id} className="space-y-2">
                    <Label htmlFor={id}>{label}</Label>
                    <Input id={id} type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={value}
                      className="h-11 rounded-xl" onChange={(event) => update(event.target.value.replace(/\D/g, ""))} disabled={isSavingPin} />
                  </div>
                ))}
              </div>
              <Button type="button" onClick={() => void savePin()} disabled={isSavingPin || newPin.length !== 4 || newPin !== confirmPin || (hasSavedPin && currentPin.length !== 4)}>
                {isSavingPin ? "Saving PIN…" : hasSavedPin ? "Change PIN" : "Set PIN"}
              </Button>
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
                      aria-pressed={selected}
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
                    <Label htmlFor="anonymous-contributions" className="text-sm font-bold">Anonymous Contributions</Label>
                    <p className="text-xs text-muted-foreground">
                      Mask your name by default on public group contributor feeds.
                    </p>
                  </div>
                </div>
                <Switch
                  id="anonymous-contributions"
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
                      Receive alerts for votes, invitations, and account activity.
                    </p>
                  </div>
                </div>
                <Switch
                  aria-label="Activity and governance alerts"
                  checked={userData.preferences.notificationsEnabled}
                  onCheckedChange={(checked) =>
                    handlePreferenceChange("notificationsEnabled", checked)
                  }
                />
              </div>
              {([
                ["walletNotifications", "Wallet payment alerts", "Deposits, outgoing transfers, and refunds to your wallet."],
                ["groupNotifications", "Group payment alerts", "Money received by your groups and verified bank contributions."],
                ["paymentVibration", "Payment vibration", "Vibrate when money arrives on supported devices. Turn this off to keep payment alerts silent."],
              ] as const).map(([key, label, description]) => (
                <div key={key} className="flex items-center justify-between gap-4 p-5">
                  <div><Label htmlFor={key} className="text-sm font-bold">{label}</Label><p className="text-xs text-muted-foreground">{description}</p></div>
                  <Switch id={key} checked={userData.preferences[key]} onCheckedChange={(value) => handlePreferenceChange(key, value)} />
                </div>
              ))}
            </div>
            <DeviceNotificationSettings />
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
              Choose a strong password for your CollectiPay account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={PASSWORD_MIN_LENGTH}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                aria-describedby="new-password-requirements"
                className="h-11 rounded-xl"
              />
              <PasswordRequirements id="new-password-requirements" password={newPassword} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">Confirm new password</Label>
              <Input
                id="confirm-new-password"
                type="password"
                autoComplete="new-password"
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
              disabled={isChangingPassword || !meetsPasswordRequirements(newPassword) || newPassword !== confirmNewPassword}
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
