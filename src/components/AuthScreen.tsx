import React, { useState } from 'react';
import { UserAccount, StudentData } from '../types';
import { apiLogin, apiRegister } from '../services/api';
import { COUNTRIES_UNIVERSITIES } from '../data/universities';
import { DEGREE_PROGRAMS, getSemestersForDegree } from '../data/degrees';
import { 
  GraduationCap, 
  Mail, 
  Lock, 
  User, 
  Building2, 
  BookOpen, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  Globe,
  Award,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

interface AuthScreenProps {
  onAuthenticated: (user: UserAccount, data: StudentData) => void;
  sessionExpiredNotice?: boolean;
}

export function AuthScreen({ onAuthenticated, sessionExpiredNotice }: AuthScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTimeoutAlert, setShowTimeoutAlert] = useState(sessionExpiredNotice || false);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [country, setCountry] = useState('India');
  const [collegeName, setCollegeName] = useState(COUNTRIES_UNIVERSITIES[0].universities[0]);
  const [customCollege, setCustomCollege] = useState('');
  const [isCustomCollege, setIsCustomCollege] = useState(false);
  const [branch, setBranch] = useState('');
  const [degreeType, setDegreeType] = useState(DEGREE_PROGRAMS[0].id);
  const [semester, setSemester] = useState('Semester 1');
  const [targetAttendance, setTargetAttendance] = useState(75);

  // Universities for selected country
  const selectedCountryObj = COUNTRIES_UNIVERSITIES.find((c) => c.country === country) || COUNTRIES_UNIVERSITIES[0];
  const universitiesList = selectedCountryObj.universities;

  // Semesters for selected degree
  const availableSemesters = getSemestersForDegree(degreeType);
  const selectedDegreeObj = DEGREE_PROGRAMS.find((d) => d.id === degreeType) || DEGREE_PROGRAMS[0];

  const handleCountryChange = (newCountry: string) => {
    setCountry(newCountry);
    const countryObj = COUNTRIES_UNIVERSITIES.find((c) => c.country === newCountry) || COUNTRIES_UNIVERSITIES[0];
    setCollegeName(countryObj.universities[0]);
    setIsCustomCollege(false);
  };

  const handleDegreeChange = (newDegreeId: string) => {
    setDegreeType(newDegreeId);
    const sems = getSemestersForDegree(newDegreeId);
    if (!sems.includes(semester)) {
      setSemester(sems[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        if (!name.trim()) {
          setError('Please enter your full name.');
          setLoading(false);
          return;
        }
        if (!email.trim() || !email.includes('@')) {
          setError('Please provide a valid email address.');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters long.');
          setLoading(false);
          return;
        }

        const finalCollege = isCustomCollege ? (customCollege.trim() || 'University') : collegeName;

        const res = await apiRegister({
          name,
          email,
          password,
          country,
          collegeName: finalCollege,
          branch: branch.trim() || 'General Studies',
          degreeType: selectedDegreeObj.name,
          semester,
          targetAttendance,
        });

        if (res.success && res.user && res.data) {
          onAuthenticated(res.user, res.data);
        } else {
          setError(res.error || 'Failed to register.');
        }
      } else {
        if (!email.trim() || !password) {
          setError('Please enter your email and password.');
          setLoading(false);
          return;
        }

        const res = await apiLogin(email, password);
        if (res.success && res.user && res.data) {
          onAuthenticated(res.user, res.data);
        } else {
          setError(res.error || 'Login failed.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Database connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      
      {/* Background Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Main Card Container */}
      <div className="w-full max-w-xl rounded-3xl bg-slate-900/85 backdrop-blur-2xl border border-white/10 p-6 sm:p-8 shadow-2xl relative z-10 my-8">
        
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/25 mb-3">
            <GraduationCap className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Academia<span className="text-indigo-400">Sync</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Personal College Timetable & Safe Bunk Manager • Connected to PostgreSQL
          </p>
        </div>

        {/* Tab Switcher: Sign In vs Sign Up */}
        <div className="flex p-1 rounded-2xl bg-white/5 border border-white/5 mb-6">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(false);
              setError('');
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              !isSignUp ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Student Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSignUp(true);
              setError('');
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              isSignUp ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            New Student Sign Up
          </button>
        </div>

        {/* Inactivity Logout Alert */}
        {showTimeoutAlert && (
          <div className="mb-4 p-3 rounded-2xl bg-amber-950/50 border border-amber-500/40 text-amber-200 text-xs font-semibold flex items-center justify-between gap-2 shadow-lg">
            <div className="flex items-center gap-2">
              <span className="text-base">⏳</span>
              <span>You were automatically signed out due to 10 minutes of inactivity.</span>
            </div>
            <button
              type="button"
              onClick={() => setShowTimeoutAlert(false)}
              className="text-amber-400 hover:text-white text-xs px-2 py-0.5 rounded bg-white/5"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Sign Up Specific Fields */}
          {isSignUp && (
            <>
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Full Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="e.g. Alex Rivera"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={isSignUp}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-400"
                  />
                </div>
              </div>

              {/* Country Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-indigo-400" />
                  Country of University *
                </label>
                <select
                  value={country}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-400"
                >
                  {COUNTRIES_UNIVERSITIES.map((c) => (
                    <option key={c.country} value={c.country} className="bg-slate-900">
                      {c.country}
                    </option>
                  ))}
                </select>
              </div>

              {/* University / College Dropdown with Custom option */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-sky-400" />
                    University / College ({country}) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCustomCollege(!isCustomCollege)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 underline"
                  >
                    {isCustomCollege ? 'Select from list' : 'Type custom college'}
                  </button>
                </div>

                {isCustomCollege ? (
                  <input
                    type="text"
                    placeholder="Type your college/institution name..."
                    value={customCollege}
                    onChange={(e) => setCustomCollege(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-400"
                  />
                ) : (
                  <select
                    value={collegeName}
                    onChange={(e) => {
                      if (e.target.value === 'Other / College Not Listed' || e.target.value === 'Other / Custom University') {
                        setIsCustomCollege(true);
                      } else {
                        setCollegeName(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-400"
                  >
                    {universitiesList.map((uni) => (
                      <option key={uni} value={uni} className="bg-slate-900">
                        {uni}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Degree Program Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  Degree / Program Being Pursued *
                </label>
                <select
                  value={degreeType}
                  onChange={(e) => handleDegreeChange(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-400"
                >
                  <optgroup label="🎓 Bachelor Degrees (Undergraduate)" className="bg-slate-900 font-bold">
                    {DEGREE_PROGRAMS.filter((d) => d.level === 'bachelor').map((d) => (
                      <option key={d.id} value={d.id} className="bg-slate-900 font-normal">
                        {d.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="📜 Master Degrees (Postgraduate)" className="bg-slate-900 font-bold">
                    {DEGREE_PROGRAMS.filter((d) => d.level === 'master').map((d) => (
                      <option key={d.id} value={d.id} className="bg-slate-900 font-normal">
                        {d.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="🔬 Doctorate & Diplomas" className="bg-slate-900 font-bold">
                    {DEGREE_PROGRAMS.filter((d) => d.level === 'doctorate' || d.level === 'diploma').map((d) => (
                      <option key={d.id} value={d.id} className="bg-slate-900 font-normal">
                        {d.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Branch & Dynamic Semester Selection */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Branch / Major *
                  </label>
                  <div className="relative">
                    <BookOpen className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="e.g. CSE / IT / Mech"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      required
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Current Semester ({availableSemesters.length} Total)
                  </label>
                  <select
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none"
                  >
                    {availableSemesters.map((sem) => (
                      <option key={sem} value={sem} className="bg-slate-900">
                        {sem}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Attendance Target */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  College Target Attendance Criteria (%)
                </label>
                <div className="flex items-center gap-2">
                  {[75, 80, 85].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTargetAttendance(t)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        targetAttendance === t
                          ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                          : 'bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      {t}% Criteria
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Email Address */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Student Email Address *
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="email"
                placeholder="student@college.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-400"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Password *
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? (
              <span>Connecting to PostgreSQL...</span>
            ) : (
              <>
                <span>{isSignUp ? 'Create My Blank Student Account' : 'Sign In to PostgreSQL Dashboard'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* PostgreSQL Database Badge */}
        <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Local PostgreSQL: academiasync
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            Individual Student Isolated
          </span>
        </div>

      </div>

      <p className="text-xs text-slate-500 mt-2 relative z-10">
        AcademiaSync • Connected to local PostgreSQL on port 5432
      </p>

    </div>
  );
}
