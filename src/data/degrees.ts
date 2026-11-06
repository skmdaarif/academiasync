export interface DegreeProgram {
  id: string;
  name: string;
  level: 'bachelor' | 'master' | 'doctorate' | 'diploma';
  durationYears: number;
  totalSemesters: number;
  description: string;
}

export const DEGREE_PROGRAMS: DegreeProgram[] = [
  // Bachelor's Degrees
  {
    id: 'btech-4yr',
    name: 'B.Tech / B.E. / B.S. Engineering (4 Years - 8 Semesters)',
    level: 'bachelor',
    durationYears: 4,
    totalSemesters: 8,
    description: 'Bachelor of Technology / Engineering',
  },
  {
    id: 'bsc-bca-3yr',
    name: 'B.Sc / B.C.A. / B.B.A. / B.Com / B.A. (3 Years - 6 Semesters)',
    level: 'bachelor',
    durationYears: 3,
    totalSemesters: 6,
    description: '3-Year Undergraduate Bachelor Degree',
  },
  {
    id: 'barch-dual-5yr',
    name: 'B.Arch / Dual Degree / Integrated B.Tech+M.Tech (5 Years - 10 Semesters)',
    level: 'bachelor',
    durationYears: 5,
    totalSemesters: 10,
    description: '5-Year Architecture or Dual Degree',
  },
  {
    id: 'bpharm-4yr',
    name: 'B.Pharm / Pharmacy (4 Years - 8 Semesters)',
    level: 'bachelor',
    durationYears: 4,
    totalSemesters: 8,
    description: 'Bachelor of Pharmacy',
  },
  {
    id: 'mbbs-med-5.5yr',
    name: 'MBBS / Medical Degree (5.5 Years - 9 Semesters + Intern)',
    level: 'bachelor',
    durationYears: 5.5,
    totalSemesters: 9,
    description: 'Medical Bachelor Degree',
  },
  {
    id: 'llb-3yr',
    name: 'LL.B. / Law (3 Years - 6 Semesters)',
    level: 'bachelor',
    durationYears: 3,
    totalSemesters: 6,
    description: 'Bachelor of Laws (Graduate entry)',
  },
  {
    id: 'ba-llb-5yr',
    name: 'B.A. LL.B. / B.B.A. LL.B. (5 Years - 10 Semesters)',
    level: 'bachelor',
    durationYears: 5,
    totalSemesters: 10,
    description: 'Integrated 5-Year Law Degree',
  },

  // Master's Degrees
  {
    id: 'mtech-ms-2yr',
    name: 'M.Tech / M.E. / M.S. Engineering (2 Years - 4 Semesters)',
    level: 'master',
    durationYears: 2,
    totalSemesters: 4,
    description: 'Master of Technology / Master of Science in Engineering',
  },
  {
    id: 'msc-mca-mba-2yr',
    name: 'M.Sc / M.C.A. / M.B.A. / M.Com / M.A. (2 Years - 4 Semesters)',
    level: 'master',
    durationYears: 2,
    totalSemesters: 4,
    description: '2-Year Postgraduate Master Degree',
  },
  {
    id: 'integrated-msc-5yr',
    name: 'Integrated M.Sc / BS-MS (5 Years - 10 Semesters)',
    level: 'master',
    durationYears: 5,
    totalSemesters: 10,
    description: '5-Year Integrated Science Master Program',
  },
  {
    id: 'phd-research',
    name: 'Ph.D. / Doctorate / Research Scholar (Custom Semesters)',
    level: 'doctorate',
    durationYears: 4,
    totalSemesters: 8,
    description: 'Doctor of Philosophy / Research',
  },
  {
    id: 'diploma-3yr',
    name: 'Polytechnic Diploma (3 Years - 6 Semesters)',
    level: 'diploma',
    durationYears: 3,
    totalSemesters: 6,
    description: 'Engineering / Technical Polytechnic Diploma',
  },
];

export function getSemestersForDegree(degreeId: string): string[] {
  const prog = DEGREE_PROGRAMS.find((d) => d.id === degreeId) || DEGREE_PROGRAMS[0];
  const list: string[] = [];
  for (let i = 1; i <= prog.totalSemesters; i++) {
    list.push(`Semester ${i}`);
  }
  return list;
}
