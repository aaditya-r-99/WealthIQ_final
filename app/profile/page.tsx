'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LoadingState } from '@/components/state-components';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/types';
import { CheckCircle2, AlertCircle, Loader2, Save } from 'lucide-react';

const employmentTypes = [
  'Full-time',
  'Part-time',
  'Self-employed',
  'Business owner',
  'Student',
  'Retired',
  'Unemployed',
  'Other',
];

const incomeStabilities = [
  'Very stable',
  'Stable',
  'Variable',
  'Seasonal',
  'Freelance / Contract',
];

const financialGoals = [
  'Build emergency fund',
  'Become debt-free',
  'Start investing',
  'Save for a house',
  'Plan for retirement',
  'Save for education',
  'Other',
];

const riskTolerances = [
  'Conservative',
  'Moderate',
  'Aggressive',
];

export default function ProfilePage() {
  const { user, authState, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    full_name: '',
    age: '',
    country: '',
    employment_type: '',
    income_stability: '',
    financial_goal: '',
    risk_tolerance: '',
  });

  const loadedUserIdRef = useRef<string | null>(null);
  const userMetadataRef = useRef(user?.user_metadata);
  userMetadataRef.current = user?.user_metadata;

  const fetchProfile = useCallback(
    async (userId: string, showLoading = true) => {
      if (showLoading) setLoading(true);
      setErrorMessage(null);

      try {
        const { data, error } = await (supabase.from('profiles') as any)
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (error) {
          console.error('Error fetching profile:', error);
          setErrorMessage(error.message || 'Failed to load profile from database.');
          return;
        }

        const profile = data as Database['public']['Tables']['profiles']['Row'] | null;

        if (profile) {
          setFormData({
            full_name: profile.full_name ?? '',
            age: profile.age !== null && profile.age !== undefined ? String(profile.age) : '',
            country: profile.country ?? '',
            employment_type: profile.employment_type ?? '',
            income_stability: profile.income_stability ?? '',
            financial_goal: profile.financial_goal ?? '',
            risk_tolerance: profile.risk_tolerance ?? '',
          });
        } else {
          // If no row exists yet, initialize full_name from auth user metadata
          setFormData((prev) => ({
            ...prev,
            full_name: userMetadataRef.current?.full_name ?? '',
          }));
        }
      } catch (err: unknown) {
        console.error('Fetch profile exception:', err);
        setErrorMessage(
          err instanceof Error ? err.message : 'An unexpected error occurred while loading profile.'
        );
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (user?.id) {
      if (loadedUserIdRef.current !== user.id) {
        loadedUserIdRef.current = user.id;
        fetchProfile(user.id);
      }
    } else if (authState === 'unauthenticated') {
      setLoading(false);
    }
  }, [user?.id, authState, fetchProfile]);

  const updateField = (key: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (successMessage) setSuccessMessage(null);
    if (errorMessage) setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) {
      setErrorMessage('You must be signed in to save your profile.');
      return;
    }

    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    const parsedAge = formData.age.trim() !== '' ? parseInt(formData.age, 10) : null;
    if (parsedAge !== null && (isNaN(parsedAge) || parsedAge < 1 || parsedAge > 120)) {
      setErrorMessage('Please enter an age between 1 and 120.');
      setSaving(false);
      return;
    }

    const trimmedFullName = formData.full_name.trim();
    const payload = {
      user_id: user.id,
      full_name: trimmedFullName || null,
      age: parsedAge,
      country: formData.country.trim() || null,
      employment_type: formData.employment_type || null,
      income_stability: formData.income_stability || null,
      financial_goal: formData.financial_goal || null,
      risk_tolerance: formData.risk_tolerance || null,
    };

    try {
      // 1. Supabase upsert
      const { data, error } = await (supabase.from('profiles') as any)
        .upsert(payload, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) {
        console.error('Error saving profile:', error);
        setErrorMessage(error.message || 'Failed to save profile.');
        return;
      }

      // 2. Sync full_name to auth user_metadata only if actually changed
      const currentAuthName = user.user_metadata?.full_name ?? '';
      if (trimmedFullName && trimmedFullName !== currentAuthName) {
        try {
          await supabase.auth.updateUser({
            data: { full_name: trimmedFullName },
          });
        } catch (authErr) {
          console.warn('Could not sync full_name to auth metadata:', authErr);
        }
      }

      const saved = data as Database['public']['Tables']['profiles']['Row'] | null;

      if (saved) {
        setFormData({
          full_name: saved.full_name ?? '',
          age: saved.age !== null && saved.age !== undefined ? String(saved.age) : '',
          country: saved.country ?? '',
          employment_type: saved.employment_type ?? '',
          income_stability: saved.income_stability ?? '',
          financial_goal: saved.financial_goal ?? '',
          risk_tolerance: saved.risk_tolerance ?? '',
        });
        // 3. Update AuthContext directly in memory using the exact row returned by upsert
        await refreshProfile(saved);
        // 4. Promptly transition out of saving state and show success
        setSaving(false);
        setSuccessMessage('Profile saved successfully.');
      }
    } catch (err: unknown) {
      console.error('Save profile exception:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'An unexpected error occurred while saving profile.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Profile Settings"
        description="Manage your personal details and financial preferences."
      />

      <div className="mt-6 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Financial Profile</CardTitle>
            <CardDescription>
              Your personal information helps WealthIQ analyze your financial health and calibrate your financial metrics.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <LoadingState message="Loading your profile..." />
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {successMessage && (
                  <div className="flex items-start gap-3 rounded-lg border border-success/20 bg-success/5 p-4 text-success">
                    <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{successMessage}</p>
                    </div>
                  </div>
                )}

                {errorMessage && (
                  <div className="flex items-start gap-3 rounded-lg border border-danger/20 bg-danger/5 p-4 text-danger">
                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{errorMessage}</p>
                    </div>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={user?.email ?? ''}
                      disabled
                      className="bg-muted text-muted-foreground cursor-not-allowed"
                    />
                    <p className="text-xs text-muted-foreground">
                      Your authentication email address.
                    </p>
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="full_name">Full Name</Label>
                    <Input
                      id="full_name"
                      placeholder="e.g. Aditya Sharma"
                      value={formData.full_name}
                      onChange={(e) => updateField('full_name', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="age">Age</Label>
                    <Input
                      id="age"
                      type="number"
                      min="1"
                      max="120"
                      placeholder="e.g. 28"
                      value={formData.age}
                      onChange={(e) => updateField('age', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      placeholder="e.g. India"
                      value={formData.country}
                      onChange={(e) => updateField('country', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="employment_type">Employment Type</Label>
                    <Select
                      value={formData.employment_type || undefined}
                      onValueChange={(val) => updateField('employment_type', val)}
                    >
                      <SelectTrigger id="employment_type">
                        <SelectValue placeholder="Select employment type" />
                      </SelectTrigger>
                      <SelectContent>
                        {employmentTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="income_stability">Income Stability</Label>
                    <Select
                      value={formData.income_stability || undefined}
                      onValueChange={(val) => updateField('income_stability', val)}
                    >
                      <SelectTrigger id="income_stability">
                        <SelectValue placeholder="Select income stability" />
                      </SelectTrigger>
                      <SelectContent>
                        {incomeStabilities.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="financial_goal">Primary Financial Goal</Label>
                    <Select
                      value={formData.financial_goal || undefined}
                      onValueChange={(val) => updateField('financial_goal', val)}
                    >
                      <SelectTrigger id="financial_goal">
                        <SelectValue placeholder="Select financial goal" />
                      </SelectTrigger>
                      <SelectContent>
                        {financialGoals.map((goal) => (
                          <SelectItem key={goal} value={goal}>
                            {goal}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="risk_tolerance">Risk Tolerance</Label>
                    <Select
                      value={formData.risk_tolerance || undefined}
                      onValueChange={(val) => updateField('risk_tolerance', val)}
                    >
                      <SelectTrigger id="risk_tolerance">
                        <SelectValue placeholder="Select risk tolerance" />
                      </SelectTrigger>
                      <SelectContent>
                        {riskTolerances.map((tol) => (
                          <SelectItem key={tol} value={tol}>
                            {tol}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-2">
                  <Button type="submit" disabled={saving || loading}>
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Profile
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
