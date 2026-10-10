'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Lock, User, ArrowRight, Check, AlertCircle } from 'lucide-react';
import { WealthIQLogo } from '@/components/wealthiq-logo';
import { supabase } from '@/lib/supabase/client';

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const fullName = (formData.get('name') as string)?.trim();
    const email = (formData.get('email') as string)?.trim().toLowerCase();
    const password = formData.get('password') as string;

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.user && !data.session) {
      setSuccessMessage(
        'Account created! Please check your email to confirm your account before signing in.'
      );
      setLoading(false);
      return;
    }

    if (data.session) {
      router.push('/onboarding');
      return;
    }

    setLoading(false);
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Left panel */}
      <div className="relative hidden flex-1 flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="absolute inset-0 bg-gradient-to-br from-sidebar-accent/20 to-transparent" />
        <div className="relative">
          <WealthIQLogo variant="full" size="md" theme="sidebar" href="/" />
        </div>
        <div className="relative space-y-4">
          <h2 className="text-3xl font-bold leading-tight">
            Start understanding your financial health today
          </h2>
          <ul className="space-y-3">
            {[
              'Comprehensive Financial Health Score',
              'Transparent spending risk analysis',
              'Smart Indian transaction classification',
              'Multi-year net worth forecasting',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sidebar-muted">
                <Check className="h-4 w-4 text-sidebar-accent" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative text-xs text-sidebar-muted">
          Educational AI Project — Not professional financial advice.
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <WealthIQLogo variant="full" size="md" href="/" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Create your account</CardTitle>
              <p className="text-sm text-muted-foreground">
                Get started with WealthIQ in seconds.
              </p>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-danger/20 bg-danger/5 p-3">
                  <AlertCircle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
                  <p className="text-sm text-danger">{error}</p>
                </div>
              )}

              {successMessage && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-success/20 bg-success/5 p-3">
                  <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
                  <div className="text-sm text-success">
                    <p className="font-medium">{successMessage}</p>
                    <p className="mt-1">
                      <Link href="/login" className="underline font-semibold">
                        Click here to sign in
                      </Link>
                    </p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      placeholder="John Doe"
                      className="pl-9"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="you@example.com"
                      className="pl-9"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      className="pl-9"
                      minLength={6}
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    At least 6 characters.
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Creating account...' : 'Create Account'}
                  {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link href="/login" className="font-medium text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
