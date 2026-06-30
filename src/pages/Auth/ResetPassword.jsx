import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Sparkles, KeyRound } from "lucide-react";

export default function ResetPassword() {
  const navigate = useNavigate();
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    // Check if the user is actually in a password recovery session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // If no session, it means they didn't come from a valid reset link
      // Or the link is expired
      if (!session) {
        // Look for hash fragments that Supabase might have returned on error
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const errorDescription = hashParams.get("error_description");
        
        if (errorDescription) {
          setError(errorDescription.replace(/\+/g, " "));
        } else {
          setError("Invalid or expired password reset link. Please request a new one.");
        }
      }
    };
    
    checkSession();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setIsLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        throw updateError;
      }

      setIsSuccess(true);
      // Wait a few seconds before redirecting to login
      setTimeout(() => {
        navigate("/login");
      }, 3000);
      
    } catch (err) {
      console.error("Error updating password:", err);
      setError(err.message || "Failed to update password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none" />
      <div className="absolute top-1/4 right-1/4 size-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 size-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-2 mb-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
            <KeyRound className="size-5 text-indigo-400" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight mb-2 text-white">
            Set New Password
          </h2>
          <p className="text-sm text-zinc-400">
            Please enter your new password below.
          </p>
        </div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 py-8 px-4 shadow-xl sm:rounded-xl sm:px-10">
          
          {isSuccess ? (
            <div className="text-center py-4 space-y-4">
              <div className="inline-flex items-center justify-center p-3 rounded-full bg-green-500/10 mb-2">
                <Sparkles className="size-6 text-green-400" />
              </div>
              <h3 className="text-xl font-medium text-white">Password Updated!</h3>
              <p className="text-zinc-400 text-sm">
                Your password has been successfully reset. You will be redirected to the login page shortly.
              </p>
              <Button 
                onClick={() => navigate('/login')} 
                className="mt-6 w-full bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700"
              >
                Go to Login Now
              </Button>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-zinc-300">
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-12 pr-10 bg-zinc-950 border-zinc-800 text-white focus:border-indigo-500 focus:ring-indigo-500"
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-sm font-medium text-zinc-300">
                  Confirm Password
                </Label>
                <Input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="h-12 bg-zinc-950 border-zinc-800 text-white focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="Confirm new password"
                />
              </div>

              {error && (
                <div className="p-3 text-sm text-red-400 bg-red-950/50 border border-red-900/50 rounded-lg">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading || !!error.includes('expired')}
                className="w-full h-12 text-base font-medium bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {isLoading ? "Saving..." : "Reset Password"}
              </Button>
              
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="text-sm font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Return to Login
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
