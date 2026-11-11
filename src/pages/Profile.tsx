import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Footer } from '@/components/Footer';
import { SEOHead } from '@/components/SEO';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { User, Mail, Phone, Calendar, Save, ArrowLeft, Lock, AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { BottomNav } from '@/components/mobile/BottomNav';

const DELETE_WORD = 'DELETE';

const Profile = () => {
  const navigate = useNavigate();
  const { data: userData, isLoading, refetch } = useCurrentUser();
  const [isSaving, setIsSaving] = useState(false);
  const isMobile = useIsMobile();

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    dateOfBirth: '',
  });

  // Delete-account dialog state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (userData?.profile) {
      setFormData({
        fullName: userData.profile.full_name || '',
        phone: userData.profile.phone_number || '',
        dateOfBirth: userData.profile.date_of_birth || '',
      });
    }
  }, [userData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userData?.id) {
      toast.error('Please login to update profile');
      navigate('/auth');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.fullName,
          phone_number: formData.phone,
          date_of_birth: formData.dateOfBirth || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userData.id);

      if (error) throw error;

      toast.success('Profile updated successfully!');
      refetch();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const closeDeleteDialog = (open: boolean) => {
    if (isDeleting) return; // never close while the request is running
    setDeleteOpen(open);
    if (!open) {
      setConfirmText('');
      setDeleteError(null);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const { data, error } = await supabase.functions.invoke('delete-my-account', { method: 'POST' });
      if (error || data?.error) {
        throw new Error(data?.error || 'Could not delete account. Please try again.');
      }
      await supabase.auth.signOut();
      toast.success('Your account has been deleted');
      navigate('/', { replace: true });
    } catch (err: any) {
      const message = err?.message || 'Could not delete account. Please try again.';
      setDeleteError(message);
      toast.error('Could not delete account. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        {!isMobile && <DashboardHeader />}
        <main className="flex-1 bg-muted/30">
          <Skeleton className="h-40 md:h-48 rounded-b-3xl md:rounded-none" />
          <div className="container mx-auto px-4 -mt-10 max-w-5xl space-y-6">
            <Skeleton className="h-96 rounded-xl" />
          </div>
        </main>
        {isMobile ? <BottomNav /> : <Footer />}
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="min-h-screen flex flex-col">
        {!isMobile && <DashboardHeader />}
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold">Please Login</h1>
            <Button onClick={() => navigate('/auth')}>Go to Login</Button>
          </div>
        </main>
        {isMobile ? <BottomNav /> : <Footer />}
      </div>
    );
  }

  const displayName = userData.profile?.full_name || userData.email?.split('@')[0] || 'User';
  const initial = userData.profile?.full_name?.charAt(0) || userData.email?.charAt(0) || 'U';
  const canDelete = confirmText === DELETE_WORD && !isDeleting;

  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead title="My Profile | SimpleLecture" description="Manage your profile settings" />
      {!isMobile && <DashboardHeader />}

      <main className="flex-1 bg-muted/30">
        {/* Hero */}
        <section className="bg-gradient-primary text-primary-foreground rounded-b-3xl md:rounded-none px-5 pt-10 pb-20 md:py-14">
          <div className="container mx-auto max-w-5xl">
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                className="mb-4 -ml-2 text-primary-foreground hover:bg-white/10"
                onClick={() => navigate(-1)}
                aria-label="Go back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div className="flex flex-col items-center text-center md:flex-row md:text-left md:items-center md:gap-6">
              <Avatar className="h-24 w-24 md:h-28 md:w-28 ring-4 ring-white/80 shadow-xl">
                <AvatarImage src={userData.profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-white text-primary text-3xl font-bold">{initial}</AvatarFallback>
              </Avatar>
              <div className="mt-4 md:mt-0 min-w-0">
                <h1 className="text-2xl md:text-3xl font-bold truncate">{displayName}</h1>
                <p className="text-sm text-primary-foreground/80 truncate">{userData.email}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Body: one layout for phone and desktop */}
        <div className="container mx-auto px-4 -mt-10 max-w-5xl pb-24 md:pb-12 grid gap-6 lg:grid-cols-3">
          {/* Personal details */}
          <Card className="lg:col-span-2 rounded-xl border-0 shadow-lg">
            <form onSubmit={handleSubmit}>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold">Personal details</CardTitle>
                <CardDescription>Keep your name, phone number and date of birth up to date.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="fullName" className="flex items-center gap-2 text-sm font-medium">
                    <User className="h-4 w-4 text-muted-foreground" />
                    Full name
                  </Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="Enter your full name"
                    className="h-11 rounded-lg"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2 text-sm font-medium">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    Phone number
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 XXXXX XXXXX"
                    className="h-11 rounded-lg"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth" className="flex items-center gap-2 text-sm font-medium">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    Date of birth
                  </Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    className="h-11 rounded-lg"
                  />
                </div>
              </CardContent>
              <CardFooter className="justify-end border-t pt-6">
                <Button type="submit" size="lg" className="w-full sm:w-auto h-11 rounded-xl px-8" disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  {isSaving ? 'Saving...' : 'Save changes'}
                </Button>
              </CardFooter>
            </form>
          </Card>

          {/* Account */}
          <Card className="lg:col-span-1 rounded-xl border-0 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">Account</CardTitle>
              <CardDescription>Your sign-in details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2 text-sm font-medium">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Email address
              </Label>
              <div className="relative">
                <Input id="email" type="email" value={userData.email || ''} disabled className="h-11 rounded-lg bg-muted/60 pr-9 cursor-not-allowed" />
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">Your email cannot be changed.</p>
            </CardContent>
          </Card>

          {/* Danger zone */}
          <Card className="lg:col-span-3 rounded-xl border border-destructive/30 bg-destructive/5 shadow-none">
            <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 mt-0.5 text-destructive shrink-0" />
                <div>
                  <p className="font-semibold text-destructive">Delete account</p>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete your account, enrolments, progress and test results. This cannot be undone.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="destructive"
                className="w-full sm:w-auto rounded-xl"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete account
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      <AlertDialog open={deleteOpen} onOpenChange={closeDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete your account?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>This permanently removes:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>your profile and personal details</li>
                  <li>your course enrolments and progress</li>
                  <li>your test, DPP and assignment results</li>
                </ul>
                <p className="font-medium">This cannot be undone.</p>
                <div className="space-y-2 pt-2">
                  <Label htmlFor="confirmDelete" className="text-sm font-medium">
                    Type <span className="font-mono font-semibold">{DELETE_WORD}</span> to confirm
                  </Label>
                  <Input
                    id="confirmDelete"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    autoComplete="off"
                    disabled={isDeleting}
                    className="h-11 rounded-lg"
                  />
                </div>
                {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            {/* A plain button, not AlertDialogAction, so the dialog stays open while the request runs */}
            <Button variant="destructive" disabled={!canDelete} onClick={handleDeleteAccount} className="rounded-xl">
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting account...
                </>
              ) : (
                'Delete my account'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isMobile ? <BottomNav /> : <Footer />}
    </div>
  );
};

export default Profile;
