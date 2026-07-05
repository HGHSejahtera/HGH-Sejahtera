import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Sparkles, CheckCircle2 } from "lucide-react";

const toTitleCase = (str) => {
    return str
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

const Pupil = ({ 
  size = 12, 
  maxDistance = 5,
  pupilColor = "black",
  forceLookX,
  forceLookY
}) => {
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const [pupilPosition, setPupilPosition] = useState({ x: 0, y: 0 });
  const pupilRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    if (!pupilRef.current) return;
    if (forceLookX !== undefined && forceLookY !== undefined) {
      setTimeout(() => setPupilPosition({ x: forceLookX, y: forceLookY }), 0);
      return;
    }
    const pupil = pupilRef.current.getBoundingClientRect();
    const pupilCenterX = pupil.left + pupil.width / 2;
    const pupilCenterY = pupil.top + pupil.height / 2;
    const deltaX = mouseX - pupilCenterX;
    const deltaY = mouseY - pupilCenterY;
    const distance = Math.min(Math.sqrt(deltaX ** 2 + deltaY ** 2), maxDistance);
    const angle = Math.atan2(deltaY, deltaX);
    setTimeout(() => setPupilPosition({
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance
    }), 0);
  }, [mouseX, mouseY, forceLookX, forceLookY, maxDistance]);

  return (
    <div
      ref={pupilRef}
      className="rounded-full"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: pupilColor,
        transform: `translate(${pupilPosition.x}px, ${pupilPosition.y}px)`,
        transition: 'transform 0.1s ease-out',
      }}
    />
  );
};

const EyeBall = ({ 
  size = 48, 
  pupilSize = 16, 
  maxDistance = 10,
  eyeColor = "white",
  pupilColor = "black",
  isBlinking = false,
  forceLookX,
  forceLookY
}) => {
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const [pupilPosition, setPupilPosition] = useState({ x: 0, y: 0 });
  const eyeRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    if (!eyeRef.current) return;
    if (forceLookX !== undefined && forceLookY !== undefined) {
      setTimeout(() => setPupilPosition({ x: forceLookX, y: forceLookY }), 0);
      return;
    }
    const eye = eyeRef.current.getBoundingClientRect();
    const eyeCenterX = eye.left + eye.width / 2;
    const eyeCenterY = eye.top + eye.height / 2;
    const deltaX = mouseX - eyeCenterX;
    const deltaY = mouseY - eyeCenterY;
    const distance = Math.min(Math.sqrt(deltaX ** 2 + deltaY ** 2), maxDistance);
    const angle = Math.atan2(deltaY, deltaX);
    setTimeout(() => setPupilPosition({
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance
    }), 0);
  }, [mouseX, mouseY, forceLookX, forceLookY, maxDistance]);

  return (
    <div
      ref={eyeRef}
      className="rounded-full flex items-center justify-center transition-all duration-150"
      style={{
        width: `${size}px`,
        height: isBlinking ? '2px' : `${size}px`,
        backgroundColor: eyeColor,
        overflow: 'hidden',
      }}
    >
      {!isBlinking && (
        <div
          className="rounded-full"
          style={{
            width: `${pupilSize}px`,
            height: `${pupilSize}px`,
            backgroundColor: pupilColor,
            transform: `translate(${pupilPosition.x}px, ${pupilPosition.y}px)`,
            transition: 'transform 0.1s ease-out',
          }}
        />
      )}
    </div>
  );
};

export function Registration() {
    const navigate = useNavigate();
    
    // State for initial form
    const [name, setName] = useState('');
    const [nickname, setNickname] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    
    // State for secret mode
    const [isSecretMode, setIsSecretMode] = useState(false);
    const [determinedRole, setDeterminedRole] = useState('');
    const [realPassword, setRealPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showRealPassword, setShowRealPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    
    // UI state
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);

    // Animation states
    const [mouseX, setMouseX] = useState(0);
    const [mouseY, setMouseY] = useState(0);
    const [isPurpleBlinking, setIsPurpleBlinking] = useState(false);
    const [isBlackBlinking, setIsBlackBlinking] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [isLookingAtEachOther, setIsLookingAtEachOther] = useState(false);
    const [isPurplePeeking, setIsPurplePeeking] = useState(false);
    
    const purpleRef = useRef(null);
    const blackRef = useRef(null);
    const yellowRef = useRef(null);
    const orangeRef = useRef(null);

    const [positions, setPositions] = useState({
        purple: { faceX: 0, faceY: 0, bodySkew: 0 },
        black: { faceX: 0, faceY: 0, bodySkew: 0 },
        yellow: { faceX: 0, faceY: 0, bodySkew: 0 },
        orange: { faceX: 0, faceY: 0, bodySkew: 0 },
    });

    useEffect(() => {
        const handleMouseMove = (e) => {
            setMouseX(e.clientX);
            setMouseY(e.clientY);
        };
        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, []);

    useEffect(() => {
        const getRandomBlinkInterval = () => Math.random() * 4000 + 3000;
        const scheduleBlink = () => {
            const blinkTimeout = setTimeout(() => {
                setIsPurpleBlinking(true);
                setTimeout(() => {
                    setIsPurpleBlinking(false);
                    scheduleBlink();
                }, 150);
            }, getRandomBlinkInterval());
            return blinkTimeout;
        };
        const timeout = scheduleBlink();
        return () => clearTimeout(timeout);
    }, []);

    useEffect(() => {
        const getRandomBlinkInterval = () => Math.random() * 4000 + 3000;
        const scheduleBlink = () => {
            const blinkTimeout = setTimeout(() => {
                setIsBlackBlinking(true);
                setTimeout(() => {
                    setIsBlackBlinking(false);
                    scheduleBlink();
                }, 150);
            }, getRandomBlinkInterval());
            return blinkTimeout;
        };
        const timeout = scheduleBlink();
        return () => clearTimeout(timeout);
    }, []);

    useEffect(() => {
        let timer;
        if (isTyping) {
            setTimeout(() => setIsLookingAtEachOther(true), 0);
            timer = setTimeout(() => {
                setIsLookingAtEachOther(false);
            }, 800);
        } else {
            setTimeout(() => setIsLookingAtEachOther(false), 0);
        }
        return () => clearTimeout(timer);
    }, [isTyping]);

    const activePassword = isSecretMode ? realPassword : password;
    const isShowingPassword = isSecretMode ? showRealPassword : showPassword;

    useEffect(() => {
        if (activePassword.length > 0 && isShowingPassword) {
            const schedulePeek = () => {
                const peekInterval = setTimeout(() => {
                    setIsPurplePeeking(true);
                    setTimeout(() => {
                        setIsPurplePeeking(false);
                    }, 800);
                }, Math.random() * 3000 + 2000);
                return peekInterval;
            };
            const firstPeek = schedulePeek();
            return () => clearTimeout(firstPeek);
        } else {
            setTimeout(() => setIsPurplePeeking(false), 0);
        }
    }, [activePassword, isShowingPassword]);

    useEffect(() => {
        const calculatePosition = (ref) => {
            if (!ref.current) return { faceX: 0, faceY: 0, bodySkew: 0 };
            const rect = ref.current.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 3;
            const deltaX = mouseX - centerX;
            const deltaY = mouseY - centerY;
            const faceX = Math.max(-15, Math.min(15, deltaX / 20));
            const faceY = Math.max(-10, Math.min(10, deltaY / 30));
            const bodySkew = Math.max(-6, Math.min(6, -deltaX / 120));
            return { faceX, faceY, bodySkew };
        };

        setPositions({
            purple: calculatePosition(purpleRef),
            black: calculatePosition(blackRef),
            yellow: calculatePosition(yellowRef),
            orange: calculatePosition(orangeRef),
        });
    }, [mouseX, mouseY]);

    const checkSecretCode = (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (!name || !nickname || !username || !email || !password) {
            setErrorMsg('Sila isi semua ruangan (Nama, Nickname, Username, Email, Password).');
            return;
        }

        let role = '';
        if (password === 'AKUPUNYAKEDAI') role = 'Founder';
        else if (password === 'UNTUNGSERINGGIT') role = 'Manager';
        else if (password === 'AKUPUNYASISTEM') role = 'Developer';

        if (role) {
            setDeterminedRole(role);
            setIsSecretMode(true);
            setPassword(''); // Clear secret code from state just in case
        } else {
            // Normal Staff/Agent Registration
            handleNormalRegistration();
        }
    };

    const handleNormalRegistration = async () => {
        setIsLoading(true);
        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: name,
                        nickname: nickname.trim(),
                        username: username,
                        role: 'Pending'
                    }
                }
            });

            if (error) throw error;
            setIsSuccess(true);
            

        } catch (err) {
            console.error('Registration Error:', err);
            let msg = err?.message || err?.error_description || String(err);
            if (msg === '{}' || msg === '[object Object]') {
                msg = 'Unknown error occurred. Please check console for details.';
            }
            setErrorMsg(msg);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSecretRegistration = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (realPassword !== confirmPassword) {
            setErrorMsg('Password tak match bro.');
            return;
        }
        
        if (realPassword.length < 6) {
            setErrorMsg('Password kena at least 6 characters.');
            return;
        }

        setIsLoading(true);
        try {
            const { error } = await supabase.auth.signUp({
                email,
                password: realPassword,
                options: {
                    data: {
                        full_name: name,
                        nickname: nickname.trim(),
                        username: username,
                        role: determinedRole
                    }
                }
            });

            if (error) {
                console.error('Registration Error:', error);
                let msg = error?.message || error?.error_description || String(error);
                if (msg === '{}' || msg === '[object Object]') msg = 'Unknown error occurred. Please check console.';
                setErrorMsg(msg);
                return;
            }
            setIsSuccess(true);
        } catch (err) {
            console.error('Registration Catch Error:', err);
            let msg = err?.message || err?.error_description || String(err);
            if (msg === '{}' || msg === '[object Object]') msg = 'Unknown error occurred. Please check console.';
            setErrorMsg(msg);
        } finally {
            setIsLoading(false);
        }
    };


    const { purple: purplePos, black: blackPos, yellow: yellowPos, orange: orangePos } = positions;

    return (
        <div className="min-h-screen grid lg:grid-cols-2">
            {/* Left Content Section */}
            <div className="relative hidden lg:flex flex-col justify-between bg-gradient-to-br from-indigo-600 via-indigo-600 to-indigo-700 p-12 text-white">
                <div className="relative z-20">
                    <div className="flex items-center gap-2 text-lg font-semibold">
                        <div className="size-8 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center">
                            <Sparkles className="size-4" />
                        </div>
                        <span>HGH Sejahtera</span>
                    </div>
                </div>

                <div className="relative z-20 flex items-end justify-center h-[500px]">
                    {/* Cartoon Characters */}
                    <div className="relative" style={{ width: '550px', height: '400px' }}>
                        {/* Purple tall rectangle character - Back layer */}
                        <div 
                            ref={purpleRef}
                            className="absolute bottom-0 transition-all duration-700 ease-in-out"
                            style={{
                                left: '70px',
                                width: '180px',
                                height: (isTyping || (activePassword.length > 0 && !isShowingPassword)) ? '440px' : '400px',
                                backgroundColor: '#6C3FF5',
                                borderRadius: '10px 10px 0 0',
                                zIndex: 1,
                                transform: (activePassword.length > 0 && isShowingPassword)
                                    ? `skewX(0deg)`
                                    : (isTyping || (activePassword.length > 0 && !isShowingPassword))
                                        ? `skewX(${(purplePos.bodySkew || 0) - 12}deg) translateX(40px)` 
                                        : `skewX(${purplePos.bodySkew || 0}deg)`,
                                transformOrigin: 'bottom center',
                            }}
                        >
                            {/* Eyes */}
                            <div 
                                className="absolute flex gap-8 transition-all duration-700 ease-in-out"
                                style={{
                                    left: (activePassword.length > 0 && isShowingPassword) ? `${20}px` : isLookingAtEachOther ? `${55}px` : `${45 + purplePos.faceX}px`,
                                    top: (activePassword.length > 0 && isShowingPassword) ? `${35}px` : isLookingAtEachOther ? `${65}px` : `${40 + purplePos.faceY}px`,
                                }}
                            >
                                <EyeBall 
                                    size={18} 
                                    pupilSize={7} 
                                    maxDistance={5} 
                                    eyeColor="white" 
                                    pupilColor="#2D2D2D" 
                                    isBlinking={isPurpleBlinking}
                                    forceLookX={(activePassword.length > 0 && isShowingPassword) ? (isPurplePeeking ? 4 : -4) : isLookingAtEachOther ? 3 : undefined}
                                    forceLookY={(activePassword.length > 0 && isShowingPassword) ? (isPurplePeeking ? 5 : -4) : isLookingAtEachOther ? 4 : undefined}
                                />
                                <EyeBall 
                                    size={18} 
                                    pupilSize={7} 
                                    maxDistance={5} 
                                    eyeColor="white" 
                                    pupilColor="#2D2D2D" 
                                    isBlinking={isPurpleBlinking}
                                    forceLookX={(activePassword.length > 0 && isShowingPassword) ? (isPurplePeeking ? 4 : -4) : isLookingAtEachOther ? 3 : undefined}
                                    forceLookY={(activePassword.length > 0 && isShowingPassword) ? (isPurplePeeking ? 5 : -4) : isLookingAtEachOther ? 4 : undefined}
                                />
                            </div>
                        </div>

                        {/* Black tall rectangle character - Middle layer */}
                        <div 
                            ref={blackRef}
                            className="absolute bottom-0 transition-all duration-700 ease-in-out"
                            style={{
                                left: '240px',
                                width: '120px',
                                height: '310px',
                                backgroundColor: '#2D2D2D',
                                borderRadius: '8px 8px 0 0',
                                zIndex: 2,
                                transform: (activePassword.length > 0 && isShowingPassword)
                                    ? `skewX(0deg)`
                                    : isLookingAtEachOther
                                        ? `skewX(${(blackPos.bodySkew || 0) * 1.5 + 10}deg) translateX(20px)`
                                        : (isTyping || (activePassword.length > 0 && !isShowingPassword))
                                            ? `skewX(${(blackPos.bodySkew || 0) * 1.5}deg)` 
                                            : `skewX(${blackPos.bodySkew || 0}deg)`,
                                transformOrigin: 'bottom center',
                            }}
                        >
                            {/* Eyes */}
                            <div 
                                className="absolute flex gap-6 transition-all duration-700 ease-in-out"
                                style={{
                                    left: (activePassword.length > 0 && isShowingPassword) ? `${10}px` : isLookingAtEachOther ? `${32}px` : `${26 + blackPos.faceX}px`,
                                    top: (activePassword.length > 0 && isShowingPassword) ? `${28}px` : isLookingAtEachOther ? `${12}px` : `${32 + blackPos.faceY}px`,
                                }}
                            >
                                <EyeBall 
                                    size={16} 
                                    pupilSize={6} 
                                    maxDistance={4} 
                                    eyeColor="white" 
                                    pupilColor="#2D2D2D" 
                                    isBlinking={isBlackBlinking}
                                    forceLookX={(activePassword.length > 0 && isShowingPassword) ? -4 : isLookingAtEachOther ? 0 : undefined}
                                    forceLookY={(activePassword.length > 0 && isShowingPassword) ? -4 : isLookingAtEachOther ? -4 : undefined}
                                />
                                <EyeBall 
                                    size={16} 
                                    pupilSize={6} 
                                    maxDistance={4} 
                                    eyeColor="white" 
                                    pupilColor="#2D2D2D" 
                                    isBlinking={isBlackBlinking}
                                    forceLookX={(activePassword.length > 0 && isShowingPassword) ? -4 : isLookingAtEachOther ? 0 : undefined}
                                    forceLookY={(activePassword.length > 0 && isShowingPassword) ? -4 : isLookingAtEachOther ? -4 : undefined}
                                />
                            </div>
                        </div>

                        {/* Orange semi-circle character - Front left */}
                        <div 
                            ref={orangeRef}
                            className="absolute bottom-0 transition-all duration-700 ease-in-out"
                            style={{
                                left: '0px',
                                width: '240px',
                                height: '200px',
                                zIndex: 3,
                                backgroundColor: '#FF9B6B',
                                borderRadius: '120px 120px 0 0',
                                transform: (activePassword.length > 0 && isShowingPassword) ? `skewX(0deg)` : `skewX(${orangePos.bodySkew || 0}deg)`,
                                transformOrigin: 'bottom center',
                            }}
                        >
                            {/* Eyes */}
                            <div 
                                className="absolute flex gap-8 transition-all duration-200 ease-out"
                                style={{
                                    left: (activePassword.length > 0 && isShowingPassword) ? `${50}px` : `${82 + (orangePos.faceX || 0)}px`,
                                    top: (activePassword.length > 0 && isShowingPassword) ? `${85}px` : `${90 + (orangePos.faceY || 0)}px`,
                                }}
                            >
                                <Pupil size={12} maxDistance={5} pupilColor="#2D2D2D" forceLookX={(activePassword.length > 0 && isShowingPassword) ? -5 : undefined} forceLookY={(activePassword.length > 0 && isShowingPassword) ? -4 : undefined} />
                                <Pupil size={12} maxDistance={5} pupilColor="#2D2D2D" forceLookX={(activePassword.length > 0 && isShowingPassword) ? -5 : undefined} forceLookY={(activePassword.length > 0 && isShowingPassword) ? -4 : undefined} />
                            </div>
                        </div>

                        {/* Yellow tall rectangle character - Front right */}
                        <div 
                            ref={yellowRef}
                            className="absolute bottom-0 transition-all duration-700 ease-in-out"
                            style={{
                                left: '310px',
                                width: '140px',
                                height: '230px',
                                backgroundColor: '#E8D754',
                                borderRadius: '70px 70px 0 0',
                                zIndex: 4,
                                transform: (activePassword.length > 0 && isShowingPassword) ? `skewX(0deg)` : `skewX(${yellowPos.bodySkew || 0}deg)`,
                                transformOrigin: 'bottom center',
                            }}
                        >
                            {/* Eyes */}
                            <div 
                                className="absolute flex gap-6 transition-all duration-200 ease-out"
                                style={{
                                    left: (activePassword.length > 0 && isShowingPassword) ? `${20}px` : `${52 + (yellowPos.faceX || 0)}px`,
                                    top: (activePassword.length > 0 && isShowingPassword) ? `${35}px` : `${40 + (yellowPos.faceY || 0)}px`,
                                }}
                            >
                                <Pupil size={12} maxDistance={5} pupilColor="#2D2D2D" forceLookX={(activePassword.length > 0 && isShowingPassword) ? -5 : undefined} forceLookY={(activePassword.length > 0 && isShowingPassword) ? -4 : undefined} />
                                <Pupil size={12} maxDistance={5} pupilColor="#2D2D2D" forceLookX={(activePassword.length > 0 && isShowingPassword) ? -5 : undefined} forceLookY={(activePassword.length > 0 && isShowingPassword) ? -4 : undefined} />
                            </div>
                            {/* Horizontal line for mouth */}
                            <div 
                                className="absolute w-20 h-[4px] bg-[#2D2D2D] rounded-full transition-all duration-200 ease-out"
                                style={{
                                    left: (activePassword.length > 0 && isShowingPassword) ? `${10}px` : `${40 + (yellowPos.faceX || 0)}px`,
                                    top: (activePassword.length > 0 && isShowingPassword) ? `${88}px` : `${88 + (yellowPos.faceY || 0)}px`,
                                }}
                            />
                        </div>
                    </div>
                </div>

                <div className="relative z-20"></div>

                {/* Decorative elements */}
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
                <div className="absolute top-1/4 right-1/4 size-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-1/4 left-1/4 size-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            </div>

            {/* Right Registration Section */}
            <div className="flex items-center justify-center p-8 bg-zinc-950 relative text-white">
                <div className="w-full max-w-[420px]">
                    {isSuccess ? (
                        <div className="text-center animate-in fade-in zoom-in duration-500">
                            <div className="mx-auto size-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 ring-8 ring-emerald-500/5">
                                <CheckCircle2 className="size-10 text-emerald-500" />
                            </div>
                            <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">Access Granted</h2>
                            {determinedRole ? (
                                <p className="text-zinc-400 mb-8 leading-relaxed">
                                    Your <span className="font-semibold text-white">{determinedRole}</span> account has been successfully provisioned. Please check your email for the final verification step.
                                </p>
                            ) : (
                                <p className="text-zinc-400 mb-8 leading-relaxed">
                                    Your application has been securely routed to the management team. Please monitor your inbox for approval and verification.
                                </p>
                            )}
                            <Button onClick={() => navigate('/login')} className="w-full h-12 text-base font-medium bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20">
                                Return to Login
                            </Button>
                        </div>
                    ) : (
                        <>
                            {/* Header */}
                            <div className="text-center mb-10">
                        {isSecretMode ? (
                            <>
                                <div className="inline-flex items-center justify-center p-2 mb-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                                    <Sparkles className="size-5 text-indigo-400" />
                                </div>
                                <h1 className="text-3xl font-bold tracking-tight mb-2 text-white">
                                    Set Your Password
                                </h1>
                                <div className="flex items-center justify-center gap-3 mt-3">
                                    <span className="w-8 h-[1px] bg-zinc-800"></span>
                                    <span className="text-xs font-medium text-indigo-400 uppercase tracking-widest">{determinedRole} Access</span>
                                    <span className="w-8 h-[1px] bg-zinc-800"></span>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="inline-flex items-center justify-center p-2 mb-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                                    <Sparkles className="size-5 text-indigo-400" />
                                </div>
                                <h1 className="text-3xl font-bold tracking-tight mb-2 text-white">
                                    Create Account
                                </h1>
                                <div className="flex items-center justify-center gap-3 mt-3">
                                    <span className="w-8 h-[1px] bg-zinc-800"></span>
                                    <span className="text-xs font-medium text-indigo-400 uppercase tracking-widest">New Member</span>
                                    <span className="w-8 h-[1px] bg-zinc-800"></span>
                                </div>
                            </>
                        )}
                    </div>

                    {errorMsg && (
                        <div className="p-3 mb-6 text-sm text-red-400 bg-red-950/50 border border-red-900/50 rounded-lg text-center">
                            {errorMsg}
                        </div>
                    )}

                    {!isSecretMode ? (
                        <form onSubmit={checkSecretCode} className="space-y-5">
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-sm font-medium text-zinc-300">Full Name</Label>
                                <Input
                                    id="name"
                                    type="text"
                                    required
                                    value={name}
                                    onFocus={() => setIsTyping(true)}
                                    onBlur={() => setIsTyping(false)}
                                    onChange={(e) => setName(toTitleCase(e.target.value))}
                                    className="h-12 bg-zinc-900 border-zinc-800 text-white focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="nickname" className="text-sm font-medium text-zinc-300">Nickname (Nama Panggilan)</Label>
                                <Input
                                    id="nickname"
                                    type="text"
                                    required
                                    value={nickname}
                                    onFocus={() => setIsTyping(true)}
                                    onBlur={() => setIsTyping(false)}
                                    onChange={(e) => setNickname(toTitleCase(e.target.value))}
                                    className="h-12 bg-zinc-900 border-zinc-800 text-white focus:border-indigo-500 focus:ring-indigo-500"
                                    placeholder="Contoh: Riz / Fariz"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="username" className="text-sm font-medium text-zinc-300">Username</Label>
                                <Input
                                    id="username"
                                    type="text"
                                    required
                                    value={username}
                                    onFocus={() => setIsTyping(true)}
                                    onBlur={() => setIsTyping(false)}
                                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                                    className="h-12 bg-zinc-900 border-zinc-800 text-white focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-sm font-medium text-zinc-300">Email Address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    required
                                    value={email}
                                    onFocus={() => setIsTyping(true)}
                                    onBlur={() => setIsTyping(false)}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="h-12 bg-zinc-900 border-zinc-800 text-white focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-sm font-medium text-zinc-300">Password</Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        required
                                        value={password}
                                        onFocus={() => setIsTyping(true)}
                                        onBlur={() => setIsTyping(false)}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="h-12 pr-10 bg-zinc-900 border-zinc-800 text-white focus:border-indigo-500 focus:ring-indigo-500"
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

                            <Button 
                                type="submit" 
                                className="w-full h-12 mt-6 text-base font-medium bg-indigo-600 hover:bg-indigo-700 text-white" 
                                size="lg" 
                                disabled={isLoading}
                            >
                                {isLoading ? 'Processing...' : 'Register'}
                            </Button>
                        </form>
                    ) : (
                        <form onSubmit={handleSecretRegistration} className="space-y-5">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium text-zinc-500">Full Name</Label>
                                <div className="flex items-center px-3 h-12 bg-zinc-900/50 border border-zinc-800 text-zinc-400 rounded-md cursor-not-allowed">
                                    {name}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-medium text-zinc-500">Nickname</Label>
                                <div className="flex items-center px-3 h-12 bg-zinc-900/50 border border-zinc-800 text-zinc-400 rounded-md cursor-not-allowed">
                                    {nickname}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-medium text-zinc-500">Email</Label>
                                <div className="flex items-center px-3 h-12 bg-zinc-900/50 border border-zinc-800 text-zinc-400 rounded-md cursor-not-allowed overflow-hidden text-ellipsis whitespace-nowrap">
                                    {email}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="realPassword" className="text-sm font-medium text-zinc-300">Set Password</Label>
                                <div className="relative">
                                    <Input
                                        id="realPassword"
                                        type={showRealPassword ? "text" : "password"}
                                        required
                                        value={realPassword}
                                        onFocus={() => setIsTyping(true)}
                                        onBlur={() => setIsTyping(false)}
                                        onChange={(e) => setRealPassword(e.target.value)}
                                        className="h-12 pr-10 bg-zinc-900 border-zinc-800 text-white focus:border-indigo-500 focus:ring-indigo-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowRealPassword(!showRealPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                                    >
                                        {showRealPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword" className="text-sm font-medium text-zinc-300">Confirm Password</Label>
                                <div className="relative">
                                    <Input
                                        id="confirmPassword"
                                        type={showConfirmPassword ? "text" : "password"}
                                        required
                                        value={confirmPassword}
                                        onFocus={() => setIsTyping(true)}
                                        onBlur={() => setIsTyping(false)}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="h-12 pr-10 bg-zinc-900 border-zinc-800 text-white focus:border-indigo-500 focus:ring-indigo-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                                    >
                                        {showConfirmPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex space-x-3 pt-2">
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    className="flex-1 h-12 bg-transparent border-zinc-700 text-white hover:bg-zinc-800 hover:text-white"
                                    onClick={() => {
                                        setIsSecretMode(false);
                                        setDeterminedRole('');
                                    }}
                                >
                                    Back
                                </Button>
                                <Button 
                                    type="submit" 
                                    className="flex-1 h-12 bg-indigo-600 hover:bg-indigo-700 text-white" 
                                    disabled={isLoading}
                                >
                                    {isLoading ? 'Saving...' : 'Register'}
                                </Button>
                            </div>
                        </form>
                    )}
                    
                    <div className="mt-8 text-center text-sm">
                        <span className="text-zinc-500">Already have an account? </span>
                        <a href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
                            Login Here
                        </a>
                    </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
