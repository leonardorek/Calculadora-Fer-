import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calculator, 
  ChevronRight, 
  CheckCircle2, 
  ShieldCheck, 
  ArrowRight,
  Lock,
  Phone,
  Play,
  Pause,
  Volume2,
  VolumeX,
  RotateCcw,
  Sparkles,
  ChevronLeft,
  X
} from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './lib/firebase';

// --- Types ---
type ViewMode = 'landing' | 'calculator';
type CalculatorStep = 1 | 2 | 3 | 4 | 'processing' | 'result' | 'lead';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

interface FormData {
  revenue: number;
  taxRegime: string;
  infrastructure: string[];
  specialty: string;
  professionals: string;
  name: string;
  email: string;
  whatsapp: string;
  clinicName: string;
}

const INITIAL_DATA: FormData = {
  revenue: 0,
  taxRegime: '',
  infrastructure: [],
  specialty: '',
  professionals: '',
  name: '',
  email: '',
  whatsapp: '',
  clinicName: ''
};

// --- Utils ---
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('calculator');
  const [step, setStep] = useState<CalculatorStep>(1);
  const [formData, setFormData] = useState<FormData>(INITIAL_DATA);
  const [progress, setProgress] = useState(0);
  const [rawInput, setRawInput] = useState('');

  // Video State Management
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const calculateEconomy = () => {
    const revenue = formData.revenue;
    const isEligible = revenue >= 50000;

    // Lógica Lucro Presumido (32% base)
    const currentBase = revenue * 0.32;
    const currentIRPJ = currentBase * 0.15;
    const currentCSLL = currentBase * 0.09;
    const currentSurtax = Math.max(0, (currentBase - 20000) * 0.1);
    const currentTotal = currentIRPJ + currentCSLL + currentSurtax;

    // Lógica Equiparada (8% IRPJ / 12% CSLL base)
    const reducedBaseIRPJ = revenue * 0.08;
    const reducedBaseCSLL = revenue * 0.12;
    const reducedIRPJ = reducedBaseIRPJ * 0.15;
    const reducedCSLL = reducedBaseCSLL * 0.09;
    const reducedSurtax = Math.max(0, (reducedBaseIRPJ - 20000) * 0.1);
    const reducedTotal = reducedIRPJ + reducedCSLL + reducedSurtax;

    const monthlyEconomy = currentTotal - reducedTotal;
    const annualEconomy = monthlyEconomy * 12;
    const fiveYearRecovery = monthlyEconomy * 60;

    return {
      monthly: monthlyEconomy,
      annual: annualEconomy,
      recovery: fiveYearRecovery,
      reductionPercent: currentTotal > 0 ? (monthlyEconomy / currentTotal) * 100 : 0,
      isEligible
    };
  };

  const nextStep = () => {
    if (typeof step === 'number' && step < 4) {
      setStep((step + 1) as CalculatorStep);
    } else if (step === 4) {
      setStep('processing');
      let p = 0;
      const interval = setInterval(() => {
        p += 2;
        setProgress(p);
        if (p >= 100) {
          clearInterval(interval);
          setTimeout(() => setStep('result'), 500);
        }
      }, 50);
    }
  };

  const prevStep = () => {
    if (step === 'result') {
      setStep(4);
    } else if (typeof step === 'number' && step > 1) {
      setStep((step - 1) as CalculatorStep);
    }
  };

  const handleRevenueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    setRawInput(val);
    setFormData({ ...formData, revenue: Number(val) });
  };

  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || []
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  };

  const handleDirectWhatsAppRedirect = async () => {
    const economy = calculateEconomy();
    const leadsCollection = 'leads';

    try {
      // 1. Save to Firestore
      await addDoc(collection(db, leadsCollection), {
        revenue: formData.revenue,
        taxRegime: formData.taxRegime,
        infrastructure: formData.infrastructure,
        specialty: formData.specialty,
        professionals: formData.professionals,
        monthlyEconomy: economy.monthly,
        annualEconomy: economy.annual,
        recovery: economy.recovery,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.warn("Failed saving lead data to Firestore:", error);
    }

    // 2. Prepare WhatsApp message
    const message = `Olá! Estou no seu portal do Simulador Tributário e gostaria de solicitar uma análise estratégica de Equiparação Hospitalar para minha empresa na área da saúde.

*Meus Dados Simulados:*
- Faturamento mensal: ${formData.revenue > 0 ? formatCurrency(formData.revenue) : 'Não informado'}
- Regime Tributário: ${formData.taxRegime || 'Não informado'}
- Especialidade: ${formData.specialty || 'Não informada'}
- Economia mensal estimada: ${formatCurrency(economy.monthly)}
- Economia anual estimada: ${formatCurrency(economy.annual)}
- Recuperação retroativa (5 anos): ${formatCurrency(economy.recovery)}`;

    const encodedMessage = encodeURIComponent(message);
    // Phone number configured according to the professional's firm
    const whatsappUrl = `https://wa.me/5519996865610?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
    window.location.href = whatsappUrl;
  };

  const handleVideoPlayToggle = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch((err) => {
          console.log("Video auto play prevented", err);
        });
      }
    }
  };

  const handleVideoVolumeToggle = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  useEffect(() => {
    const testConnection = async () => {
      try {
        const { doc, getDocFromServer } = await import('firebase/firestore');
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('permission-denied')) {
          console.log("Firebase credentials successfully loaded.");
        }
      }
    };
    testConnection();
  }, []);

  const { isEligible, monthly, annual, recovery, reductionPercent } = calculateEconomy();

  return (
    <div className="min-h-screen bg-[#070707] text-white selection:bg-brand-gold selection:text-black flex flex-col font-sans relative overflow-hidden">
      
      {/* Background ambient lighting */}
      <div className="absolute top-[-300px] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-brand-gold/5 blur-[160px] rounded-full pointer-events-none" />

      {/* --- Elegant Top Bar --- */}
      <header className="w-full py-6 px-8 md:px-16 border-b border-white/[0.04] bg-black/40 backdrop-blur-md relative z-40">
        <div className="max-w-7xl mx-auto flex justify-center items-center">
          
          {/* Logo Brand Custom - Centered perfectly */}
          <div className="flex items-center justify-center cursor-pointer" onClick={() => { setStep(1); setRawInput(''); setFormData(INITIAL_DATA); }}>
            <img 
              src="https://melosacilottoadv.com.br/wp-content/uploads/2025/03/3.2-madeira.png" 
              alt="Melo Sacilotto Advocacia" 
              className="h-10 md:h-12 w-auto object-contain hover:brightness-110 transition-all duration-300"
              referrerPolicy="no-referrer"
            />
          </div>

        </div>
      </header>

      {/* --- Main Contents --- */}
      <main className="flex-grow flex items-start justify-center p-6 md:p-12 relative z-10 lg:pt-12">
        <div className="w-full max-w-7xl mx-auto flex flex-col gap-10">
          
          {/* Core copywriting headlines - Centered & elegant layout with optimized sizes */}
          <div className="space-y-3.5 text-center mx-auto max-w-2xl flex flex-col items-center">
            {/* Performance Shield Tag */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-gold/25 bg-brand-gold/[0.04]">
              <ShieldCheck size={11} className="text-brand-gold" />
              <span className="text-[8px] font-bold tracking-[0.3em] uppercase text-brand-gold font-sans">
                Calcule agora sua economia
              </span>
            </div>

            {/* Stunning Main Typography Pairing - Centered and slightly smaller */}
            <h1 className="text-2xl md:text-3xl xl:text-4xl text-white font-sans font-extrabold tracking-tight leading-[1.2]">
              Médico, você está <br/>
              <span className="text-brand-gold italic font-normal tracking-wide">pagando mais impostos</span> <br/>
              do que deveria!
            </h1>

            {/* High Converting Subhead detailing benefits exactly matching user screenshot */}
            <p className="text-white/70 text-xs md:text-sm leading-relaxed max-w-xl font-sans font-light">
              Utilize o benefício fiscal da <strong className="text-white font-bold">Equiparação Hospitalar</strong> e reduza <strong className="text-brand-gold font-bold">em até 70% dos seus impostos</strong> de forma legal e segura.
            </p>
          </div>

          <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-stretch w-full">
            
            {/* ================= LEFT COLUMN: INTERACTIVE CALCULATOR ================= */}
            <div className="lg:col-span-7 flex flex-col h-full">
              
              {/* --- Custom-Built Step-by-Step Interactive Calculator Container with premium obsidian gold theme and ambient glow shadow --- */}
              <div className="glass-card h-full rounded-lg border-2 border-brand-gold/60 bg-[#060607]/95 overflow-hidden flex flex-col p-6 md:p-10 relative shadow-[0_0_60px_rgba(194,163,116,0.25)] transition-all duration-300 md:min-h-[550px] lg:min-h-[610px] justify-between">
                
                {/* Visual watermark of Dra. Fernanda's brand - Elegant, extremely subtle, does not conflict with reading the calculator options */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.03] overflow-hidden select-none z-0">
                  <img 
                    src="https://melosacilottoadv.com.br/wp-content/uploads/2025/03/3.2-madeira.png" 
                    alt="Melo Sacilotto Advocacia Watermark" 
                    className="w-[85%] max-w-[420px] object-contain select-none"
                    referrerPolicy="no-referrer"
                  />
                </div>
              
              <div className="relative z-10">
                {/* Header Controls with Small Centered Logo */}
                <div className="flex flex-col items-center mb-5 pb-3.5 border-b border-white/[0.04] gap-2.5">
                  <img 
                    src="https://melosacilottoadv.com.br/wp-content/uploads/2025/03/3.2-madeira.png" 
                    alt="Melo Sacilotto Advocacia Logo" 
                    className="h-7 md:h-8 w-auto object-contain select-none"
                    referrerPolicy="no-referrer"
                  />
                  <div className="text-[10px] tracking-[0.2em] uppercase text-white/50 font-bold flex items-center gap-2.5 font-sans">
                    <Calculator size={18} className="text-brand-gold" />
                    <span>Simulador Estratégico</span>
                  </div>
                </div>

                {/* Elegant, clear Call to Action to fill the simulator */}
                <div className={`mb-6 bg-brand-gold/15 border-2 border-brand-gold/70 p-4 rounded-md text-center relative overflow-hidden shadow-[0_0_20px_rgba(194,163,116,0.15)] ${step === 1 ? 'block' : 'hidden md:block'}`}>
                  <div className="absolute inset-0 bg-gradient-to-r from-brand-gold/5 via-transparent to-brand-gold/5 pointer-events-none" />
                  <p className="text-white text-xs md:text-sm font-sans font-extrabold tracking-wider uppercase flex items-center justify-center gap-3">
                    <Calculator size={24} className="text-brand-gold animate-pulse animate-duration-1000" />
                    <span className="text-brand-gold [text-shadow:_0_1px_10px_rgba(194,163,116,0.3)]">Calcule agora quanto você pode economizar de impostos</span>
                  </p>
                </div>
              </div>

              <div className="flex-grow flex flex-col justify-center relative z-10">
                <AnimatePresence mode="wait">
                        
                        {/* --- Step 1: Revenue --- */}
                        {step === 1 && (
                          <motion.div
                            key="calc_s1"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            className="space-y-6"
                          >
                            <div className="text-center space-y-2">
                              <h3 className="text-2xl md:text-[26px] font-sans font-bold text-white px-4 leading-tight">Qual o faturamento médio mensal da sua empresa?</h3>
                            </div>
                            
                            <div className="relative pt-4 flex items-center justify-center bg-white/[0.01] border-b border-brand-gold/25 p-4 md:p-6 rounded-sm">
                              <span className="text-brand-gold font-sans text-3xl md:text-4xl font-extrabold mr-2 select-none">R$</span>
                              <input 
                                type="text" 
                                inputMode="numeric"
                                pattern="[0-9]*"
                                autoFocus
                                value={rawInput ? Number(rawInput).toLocaleString('pt-BR') : ''}
                                onChange={handleRevenueChange}
                                placeholder="0,00"
                                className="w-48 md:w-80 bg-transparent text-3xl md:text-5xl font-sans font-extrabold text-white outline-none placeholder:text-white/10 text-left"
                              />
                            </div>
                            
                            <p className="text-center text-white/30 text-[9px] tracking-widest uppercase font-bold font-sans">
                              *recomendado para médicos e dentistas cirurgiões
                            </p>
                          </motion.div>
                        )}

                        {/* --- Step 2: Tax Regime --- */}
                        {step === 2 && (
                          <motion.div
                            key="calc_s2"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            className="space-y-6"
                          >
                            <div className="text-center space-y-2">
                              <h3 className="text-2xl md:text-[26px] font-sans font-bold text-white px-4 leading-tight">Qual o seu regime tributário hoje?</h3>
                            </div>
                            
                            <div className="grid gap-3 pt-2">
                              {['Lucro Presumido', 'Simples Nacional', 'Lucro Real', 'Não tenho certeza'].map((opt) => (
                                <button
                                  key={opt}
                                  onClick={() => { 
                                    setFormData({ ...formData, taxRegime: opt }); 
                                    nextStep(); 
                                  }}
                                  className={`p-5 text-left border transition-all flex justify-between items-center group font-sans ${formData.taxRegime === opt ? 'border-brand-gold bg-brand-gold/10 text-brand-gold' : 'border-white/5 bg-white/[0.01] hover:border-white/20 hover:bg-white/[0.04] text-white/70'}`}
                                >
                                  <span className="font-bold text-sm tracking-tight">{opt}</span>
                                  <ChevronRight className="w-6 h-6 md:w-4 md:h-4 opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}

                        {/* --- Step 3: Areas of Practice --- */}
                        {step === 3 && (
                          <motion.div
                            key="calc_s3"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            className="space-y-6"
                          >
                            <div className="text-center space-y-2">
                              <h3 className="text-2xl md:text-[26px] font-sans font-bold text-white px-4 leading-tight">Você atua em quais áreas?</h3>
                            </div>
                            
                            <div className="grid gap-3 pt-2">
                              {[
                                { id: 'planton', label: 'Faço plantões em hospitais' },
                                { id: 'cirurgia_hosp', label: 'Faço cirurgias em hospitais' },
                                { id: 'cirurgia_clinica', label: 'Faço cirurgias em minha própria clínica' },
                                { id: 'exame_diag', label: 'Faço exames de imagem e diagnóstico' },
                                { id: 'proc_invasivo', label: 'Faço procedimentos invasivos' }
                              ].map((opt) => {
                                const active = formData.infrastructure.includes(opt.id);
                                return (
                                  <button
                                    key={opt.id}
                                    onClick={() => {
                                      const next = active 
                                        ? formData.infrastructure.filter(i => i !== opt.id)
                                        : [...formData.infrastructure, opt.id];
                                      setFormData({ ...formData, infrastructure: next });
                                    }}
                                    className={`p-5 text-left border transition-all flex justify-between items-center font-sans ${active ? 'border-brand-gold bg-brand-gold/10 text-brand-gold' : 'border-white/5 bg-white/[0.01] hover:border-white/20 hover:bg-white/[0.03] text-white/70'}`}
                                  >
                                    <span className="font-bold text-xs md:text-sm tracking-tight leading-relaxed max-w-[85%]">{opt.label}</span>
                                    <div className={`w-7 h-7 md:w-5 md:h-5 rounded border flex flex-shrink-0 items-center justify-center transition-all ${active ? 'bg-brand-gold border-brand-gold text-black' : 'border-white/20'}`}>
                                      {active && <CheckCircle2 className="w-5 h-5 md:w-3.5 md:h-3.5" strokeWidth={4} />}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}

                        {/* --- Step 4: Specialties --- */}
                        {step === 4 && (
                          <motion.div
                            key="calc_s4"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            className="space-y-6"
                          >
                            <div className="text-center space-y-2">
                              <h3 className="text-2xl md:text-[26px] font-sans font-bold text-white px-4 leading-tight">Qual a sua especialidade central?</h3>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 pt-2">
                              {[
                                'Cirurgião Dentista',
                                'Médico Cirurgião',
                                'Dermatologia',
                                'Ortopedia',
                                'Cardiologia',
                                'Exames/Diagnóstico',
                                'Oftalmologia',
                                'Outras'
                              ].map((opt) => (
                                <button
                                  key={opt}
                                  onClick={() => { 
                                    setFormData({ ...formData, specialty: opt }); 
                                    nextStep(); 
                                  }}
                                  className={`p-4 text-center border transition-all font-sans ${formData.specialty === opt ? 'border-brand-gold bg-brand-gold/10 text-brand-gold font-bold' : 'border-white/5 bg-white/[0.01] hover:border-white/20 hover:bg-white/[0.02] text-white/60'}`}
                                >
                                  <span className="text-[10px] uppercase tracking-wider block font-black">{opt}</span>
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}



                        {/* --- Step: Processing --- */}
                        {step === 'processing' && (
                          <motion.div
                            key="calc_processing"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center space-y-8 py-10"
                          >
                            <div className="relative w-24 h-24 mx-auto">
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
                                className="w-full h-full border-2 border-brand-gold/10 border-t-brand-gold rounded-full"
                              />
                              <Calculator className="absolute inset-0 m-auto text-brand-gold" size={44} />
                            </div>
                            
                            <div className="space-y-2">
                              <h3 className="text-2xl font-sans font-bold text-white italic">Avaliando Requisitos Judiciais</h3>
                              <p className="text-white/40 text-[11px] uppercase tracking-widest font-mono">
                                Reduzindo IRPJ para 8% CSLL para 12%... {progress}%
                              </p>
                            </div>

                            <div className="w-full max-w-xs mx-auto bg-white/5 h-[2px] rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                className="h-full bg-brand-gold shadow-[0_0_15px_rgba(194,163,116,1)]"
                              />
                            </div>
                          </motion.div>
                        )}

                        {/* --- Step: Result --- */}
                        {step === 'result' && (
                          <motion.div
                            key="calc_result"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="space-y-6"
                          >
                            {/* Headline based on eligibility */}
                            <div className="text-center space-y-3">
                              {isEligible ? (
                                <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-4 py-1.5 rounded-full border border-emerald-500/20 text-[9px] font-black uppercase tracking-widest font-sans">
                                  <CheckCircle2 size={12} strokeWidth={3} /> Perfil Altamente Elegível
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-500 px-4 py-1.5 rounded-full border border-amber-500/20 text-[9px] font-black uppercase tracking-widest font-sans">
                                  Viabilidade Econômica a Reavaliar
                                </div>
                              )}
                              <h3 className="text-2xl md:text-3xl font-sans font-extrabold text-white">Estimativa de economia tributária</h3>
                            </div>

                            {isEligible ? (
                              <div className="space-y-3">
                                {/* Monthly and Annual Grid */}
                                <div className="grid md:grid-cols-2 gap-3">
                                  <div className="p-5 rounded border border-white/5 bg-white/[0.01] text-center">
                                    <span className="text-white/30 text-[8px] font-black uppercase tracking-widest block mb-2">Economia Mensal</span>
                                    <span className="text-brand-gold font-mono text-3xl font-bold tracking-tight">
                                      {formatCurrency(monthly)}
                                    </span>
                                  </div>

                                  <div className="p-5 rounded border border-white/5 bg-white/[0.01] text-center">
                                    <span className="text-white/30 text-[8px] font-black uppercase tracking-widest block mb-2">Economia Anual</span>
                                    <span className="text-white font-mono text-3xl font-bold tracking-tight">
                                      {formatCurrency(annual)}
                                    </span>
                                  </div>
                                </div>

                                {/* Mega highlights recovery (5 years) */}
                                <div className="p-8 rounded border border-brand-gold/20 bg-gradient-to-br from-brand-gold/10 to-transparent text-center relative overflow-hidden">
                                  <div className="absolute top-0 right-0 w-32 h-32 bg-brand-gold/5 blur-3xl rounded-full" />
                                  <span className="text-brand-gold text-[10px] font-black uppercase tracking-widest block mb-2">
                                    Potencial de Recuperação (Retroativo 5 Anos)
                                  </span>
                                  <span className="text-white font-mono text-4xl font-extrabold tracking-tight">
                                    {formatCurrency(recovery)}
                                  </span>
                                  <span className="block text-[9px] text-white/40 uppercase tracking-widest mt-2 font-mono">
                                    Redução tributária média de até {reductionPercent.toFixed(1)}% nos federais
                                  </span>
                                  <span className="block text-[10px] text-white/45 mt-3 font-sans font-light italic">
                                    *Cálculo meramente estimativo, necessária uma análise mais detalhada.
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="p-8 rounded border border-white/5 bg-white/[0.02] text-center space-y-4">
                                <p className="text-white/60 text-sm leading-relaxed font-light">
                                  Médicos com faturamento inferior a <strong>R$ 50.000,00/mês</strong> podem requerer atenção especial na amortização dos custos jurídicos incidentes na tese. No entanto, o planejamento societário preventivo permanece altamente recomendado.
                                </p>
                                <div className="h-px bg-white/5 w-16 mx-auto" />
                                <span className="block text-[9px] text-brand-gold font-black uppercase tracking-widest">
                                  Consulte a Dra. Fernanda para alternativas personalizadas.
                                </span>
                              </div>
                            )}

                            {/* CTAs */}
                            <div className="pt-2 flex flex-col md:flex-row gap-3">
                              <button 
                                onClick={handleDirectWhatsAppRedirect}
                                className="order-1 md:order-2 flex-[2] py-5 bg-[#009a60] text-white hover:bg-[#008250] hover:translate-y-[-2px] hover:scale-[1.02] active:scale-95 transition-all duration-300 text-xs md:text-sm font-black tracking-widest uppercase rounded-md flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(0,154,96,0.45)] hover:shadow-[0_0_40px_rgba(0,154,96,0.7)] ring-2 ring-emerald-500/20 hover:ring-emerald-400/40 cursor-pointer"
                              >
                                GARANTIR DIAGNÓSTICO OFICIAL COMPLETO <ArrowRight size={14} />
                              </button>
                              <button 
                                onClick={() => {
                                  setStep(1);
                                  setRawInput('');
                                  setFormData(INITIAL_DATA);
                                }}
                                className="order-2 md:order-1 flex-1 py-5 border border-white/10 text-white/50 hover:text-white hover:border-white/20 transition-all text-[10px] font-black tracking-widest uppercase rounded-sm"
                              >
                                Calcule novamente
                              </button>
                            </div>
                          </motion.div>
                        )}

                      </AnimatePresence>
                    </div>

                    {/* Step Tracker Indicator */}
                    {typeof step === 'number' && (
                      <div className="mt-8 pt-6 border-t border-white/[0.08] flex flex-col md:flex-row justify-between items-center gap-4 relative z-10">
                        <button 
                          onClick={prevStep}
                          className="w-full md:w-auto py-2 md:py-4.5 px-4 md:px-8 bg-transparent md:bg-[#1a1815] border-0 md:border-2 border-transparent md:border-brand-gold/60 hover:text-white/50 md:hover:border-brand-gold text-white/30 md:text-brand-gold md:hover:text-white font-sans font-extrabold text-[10px] md:text-sm tracking-widest uppercase flex items-center justify-center gap-1 md:gap-2 rounded-md transition-all duration-300 pointer-events-auto cursor-pointer shadow-none md:shadow-[0_2px_15px_rgba(194,163,116,0.1)] order-3 md:order-1"
                        >
                          <ChevronLeft className="w-4 h-4 md:w-[18px] md:h-[18px]" />
                          Voltar
                        </button>
                        
                        <div className="flex gap-2.5 py-2 order-2 md:order-2">
                          {[1, 2, 3, 4].map((idx) => (
                            <div 
                                key={idx}
                                className={`h-[4px] rounded-full transition-all duration-300 ${step === idx ? 'w-10 bg-brand-gold' : 'w-3 bg-white/10'}`}
                            />
                          ))}
                        </div>

                        <button 
                          onClick={nextStep}
                          disabled={(step === 1 && !formData.revenue) || (step === 4 && !formData.specialty)}
                          className={`w-full md:w-auto py-4.5 px-12 font-sans font-black text-xs md:text-sm tracking-widest uppercase flex items-center justify-center gap-2 rounded-md transition-all duration-300 cursor-pointer order-1 md:order-3 ${
                            (step === 1 && !formData.revenue) || (step === 4 && !formData.specialty)
                              ? 'bg-white/5 border border-white/10 text-white/20 cursor-not-allowed shadow-none' 
                              : 'gold-gradient text-black font-extrabold hover:brightness-125 hover:scale-[1.05] active:scale-95 shadow-[0_0_30px_rgba(197,160,89,0.45)] hover:shadow-[0_0_45px_rgba(197,160,89,0.7)] ring-2 ring-white/15'
                          }`}
                        >
                          <span>Avançar</span>
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    )}

              </div>
            </div>

          {/* ================= RIGHT COLUMN: DRA. FERNANDA CARD & CUSTOM VIDEO PLAYER ================= */}
          <div className="lg:col-span-5 flex flex-col h-full">
            <div className="glass-card h-full rounded-lg border border-white/10 bg-[#060607]/95 relative overflow-hidden shadow-2xl p-6 md:p-8 space-y-6 md:min-h-[550px] lg:min-h-[610px] flex flex-col justify-between transition-all duration-300 hover:border-white/15">
              
              {/* Gold watermark texture */}
              <div className="absolute top-0 right-0 p-8 mix-blend-overlay pointer-events-none opacity-5 font-sans text-8xl font-black italic select-none">
                MS
              </div>

              {/* Headliner information of the Specialist */}
              <div className="flex gap-4 items-center">
                <div className="w-[2px] h-12 bg-brand-gold" />
                <div>
                  <span className="block text-[8px] font-black tracking-[0.3em] text-white/40 uppercase font-sans">
                    MELO SACILOTTO • ADVOCACIA
                  </span>
                  <h3 className="text-xl font-sans text-white uppercase tracking-wider font-extrabold">
                    DRA. FERNANDA SACILOTTO
                  </h3>
                  <span className="block text-xs text-brand-gold italic font-light tracking-wide mt-0.5 font-sans">
                    Especialista em Direito Tributário Médico
                  </span>
                </div>
              </div>

              {/* Sophisticated Video Player Card */}
              <div className="relative group rounded overflow-hidden aspect-[4/3] bg-brand-gray border border-white/5 shadow-inner">
                {/* Real video tag playing an ambient cinematic loop or customizable link */}
                <video 
                  ref={videoRef}
                  src="https://melosacilottoadv.com.br/wp-content/uploads/2026/05/Video-do-WhatsApp-de-2025-03-17-as-11.44.27_297fc4aa.mp4#t=0.001"
                  loop
                  muted={isMuted}
                  className={`w-full h-full object-cover transition-all duration-300 ${isPlaying ? "brightness-100" : "grayscale brightness-[0.4] group-hover:brightness-[0.5]"}`}
                  playsInline
                  preload="metadata"
                />

                {/* Nice Static Golden Overlaid Title and Play button */}
                <AnimatePresence>
                  {!isPlaying && (
                    <motion.div 
                      key="play_overlay"
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={handleVideoPlayToggle}
                      className="absolute inset-0 cursor-pointer flex flex-col items-center justify-center p-6 text-center select-none"
                    >
                      <div className="w-16 h-16 rounded-full border border-brand-gold/40 flex items-center justify-center bg-black/60 backdrop-blur-md group-hover:scale-110 transition-transform shadow-2xl shadow-brand-gold/10">
                        <Play size={20} className="text-brand-gold translate-x-0.5" />
                      </div>
                      
                      <div className="mt-4 space-y-1">
                        <span className="block text-[9px] tracking-[0.3em] font-black uppercase text-brand-gold">
                          Clique para Assistir
                        </span>
                        <p className="text-[10px] text-white/50 max-w-[200px] leading-relaxed font-light">
                          Entenda a Tese de Equiparação Hospitalar com a Dra. Fernanda
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Minimal Control Row Overlaid at the Bottom */}
                <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center pointer-events-none select-none z-20">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleVideoPlayToggle();
                    }}
                    className="pointer-events-auto p-2 bg-black/55 backdrop-blur-sm border border-white/10 rounded text-white/70 hover:text-white transition-colors cursor-pointer"
                  >
                    {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                  </button>

                  <div className="flex gap-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVideoVolumeToggle();
                      }}
                      className="pointer-events-auto p-2 bg-black/55 backdrop-blur-sm border border-white/10 rounded text-white/70 hover:text-white transition-colors cursor-pointer"
                    >
                      {isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                    </button>
                    {isPlaying && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (videoRef.current) {
                            videoRef.current.currentTime = 0;
                          }
                        }}
                        className="pointer-events-auto p-2 bg-black/55 backdrop-blur-sm border border-white/10 rounded text-white/70 hover:text-white transition-colors cursor-pointer"
                      >
                        <RotateCcw size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Tiny simulated duration overlay */}
                {isPlaying && (
                  <div className="absolute bottom-0 left-0 h-1 bg-brand-gold animate-[shimmer_12s_infinite]" style={{ width: '40%' }} />
                )}

              </div>

              {/* Sub-text Credentials & Pulse Indicators */}
              <div className="flex justify-center items-center text-[11px] font-bold tracking-widest text-[#00e676] border-b border-white/[0.04] pb-4">
                <div className="flex items-center gap-2 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> Foco em médicos e dentistas cirurgiões
                </div>
              </div>

              {/* Bottom statistics display representing high prestige */}
              <div className="grid grid-cols-2 gap-4">
                
                <div className="space-y-1">
                  <span className="block text-[8px] font-black text-white/30 uppercase tracking-widest">
                    Volume Restituído
                  </span>
                  <span className="block font-sans text-lg text-white font-black tracking-tight">
                    +R$ 50 MILHÕES
                  </span>
                </div>
 
                <div className="space-y-1">
                  <span className="block text-[8px] font-black text-white/30 uppercase tracking-widest font-sans">
                    Conformidade Fiscal
                  </span>
                  <span className="block font-sans text-lg text-brand-gold font-black uppercase tracking-tight">
                    100% LEGAL
                  </span>
                </div>

              </div>

            </div>
          </div>

        </div>

        {/* Elegant WhatsApp Call to Action set below columns to align cards and offer full width balance */}
        <div className="pt-10 mt-6 border-t border-white/[0.06] relative max-w-2xl mx-auto w-full">
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#070707] px-4 text-center whitespace-nowrap">
            <span className="text-[8px] font-bold tracking-[0.2em] text-brand-gold/60 uppercase">Ou se preferir contato direto</span>
          </div>
          <a 
            href="https://wa.me/5519996865610?text=Ol%C3%A1!%20Estou%20no%20seu%20portal%20do%20Simulador%20Tribut%C3%A1rio%20e%20gostaria%20de%20solicitar%20uma%20an%C3%A1lise%20estrat%C3%A9gica%20de%20Equipara%C3%A7%C3%A3o%20Hospitalar%20para%20minha%20empresa%20na%20%C3%A1rea%20da%20sa%C3%BAde."
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-4.5 px-6 rounded-md bg-[#009a60] text-white hover:bg-[#008250] hover:translate-y-[-2px] hover:scale-[1.01] active:scale-99 hover:shadow-2xl hover:shadow-[#009a60]/30 font-sans font-extrabold text-xs tracking-[0.2em] uppercase flex items-center justify-center gap-3 transition-all duration-300 shadow-lg shadow-[#009a60]/10 border border-emerald-500/20 ring-2 ring-emerald-500/10 hover:ring-emerald-400/30 cursor-pointer"
          >
            {/* WhatsApp Phone Lucide Icon */}
            <Phone size={15} className="fill-white text-white" />
            <span>Falar no WhatsApp com Especialista</span>
            <ChevronRight size={13} className="ml-1 opacity-70" />
          </a>
          <span className="block text-center text-white/30 text-[9px] tracking-widest uppercase mt-2 font-sans font-light">
            • Atendimento imediato de viabilidade fiscal sem custos iniciais •
          </span>
        </div>

      </div>
    </main>

      {/* --- Minimal Security / Footnote Row --- */}
      <footer className="py-8 px-6 border-t border-white/[0.04] bg-black/20 text-center relative z-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] text-white/30 tracking-widest font-black uppercase">
          <p>
            Melo Sacilotto Advocacia © 2026. Todos os direitos reservados.
          </p>
          <div className="flex gap-6">
            <span className="flex items-center gap-1.5"><Lock size={12} /> LGPD Protegido</span>
            <span className="flex items-center gap-1.5"><ShieldCheck size={12} /> Jurisprudência STJ</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
