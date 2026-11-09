import { StudentData, UserAccount, Course, TimeSlot, Task, AttendanceRecord } from '../types';

export function getDemoStudentUser(): UserAccount {
  return {
    id: 'demo-student-user-001',
    name: 'Alex Rivera',
    email: 'alex.rivera@campus.edu',
    country: 'United States',
    collegeName: 'California Institute of Technology',
    branch: 'Computer Science & Engineering',
    degreeType: 'B.Tech / B.E. (4 Years - 8 Semesters)',
    semester: 'Semester 5',
    totalSemesters: 8,
    collegeMinAttendance: 75,
    personalGoalAttendance: 85,
    targetAttendance: 75,
    theme: 'dark-slate',
    staySignedIn: true,
    storageMode: 'local',
  };
}

export function getDemoStudentData(): StudentData {
  const courses: Course[] = [
    {
      id: 'c-os-301',
      code: 'CS301',
      name: 'Operating Systems & Kernels',
      professor: 'Dr. Aris Thorne',
      defaultRoom: 'Hall 302',
      color: '#3b82f6', // Blue
      credits: 4,
      attendanceGoal: 80,
      totalClasses: 22,
      attendedClasses: 20, // 90.9% (Safe)
    },
    {
      id: 'c-dsa-302',
      code: 'CS302',
      name: 'Data Structures & Algorithms',
      professor: 'Prof. Sarah Jenkins',
      defaultRoom: 'Turing Lab 4',
      color: '#8b5cf6', // Purple
      credits: 4,
      attendanceGoal: 75,
      totalClasses: 24,
      attendedClasses: 21, // 87.5% (Safe)
    },
    {
      id: 'c-cn-303',
      code: 'CS303',
      name: 'Computer Networks & Protocols',
      professor: 'Prof. David Miller',
      defaultRoom: 'Hall 204',
      color: '#ef4444', // Red
      credits: 3,
      attendanceGoal: 75,
      totalClasses: 20,
      attendedClasses: 14, // 70.0% (Warning below 75%!)
    },
    {
      id: 'c-dbms-304',
      code: 'CS304',
      name: 'Database Management Systems',
      professor: 'Dr. Elena Vance',
      defaultRoom: 'Room 105',
      color: '#10b981', // Emerald
      credits: 3,
      attendanceGoal: 75,
      totalClasses: 18,
      attendedClasses: 17, // 94.4% (Safe)
    },
    {
      id: 'c-aiml-305',
      code: 'AI305',
      name: 'Artificial Intelligence & Neural Nets',
      professor: 'Dr. Robert Chen',
      defaultRoom: 'Innovation Hub',
      color: '#f59e0b', // Amber
      credits: 3,
      attendanceGoal: 85,
      totalClasses: 16,
      attendedClasses: 14, // 87.5% (Safe)
    },
  ];

  const timeSlots: TimeSlot[] = [
    // Monday
    { id: 's-mon-1', courseId: 'c-os-301', day: 'Monday', startTime: '09:00', endTime: '10:15', room: 'Hall 302', type: 'Lecture', notes: 'Process Scheduling' },
    { id: 's-mon-2', courseId: 'c-dsa-302', day: 'Monday', startTime: '10:30', endTime: '11:45', room: 'Turing Lab 4', type: 'Lecture', notes: 'B-Trees & Heaps' },
    { id: 's-mon-3', courseId: 'c-aiml-305', day: 'Monday', startTime: '13:30', endTime: '15:00', room: 'Innovation Hub', type: 'Lab', notes: 'Backpropagation with PyTorch' },

    // Tuesday
    { id: 's-tue-1', courseId: 'c-cn-303', day: 'Tuesday', startTime: '09:00', endTime: '10:15', room: 'Hall 204', type: 'Lecture', notes: 'TCP Flow Control' },
    { id: 's-tue-2', courseId: 'c-dbms-304', day: 'Tuesday', startTime: '10:30', endTime: '11:45', room: 'Room 105', type: 'Lecture', notes: 'B+ Tree Indexing' },
    { id: 's-tue-3', courseId: 'c-os-301', day: 'Tuesday', startTime: '14:00', endTime: '16:00', room: 'Systems Lab', type: 'Lab', notes: 'Linux Kernel Modules' },

    // Wednesday
    { id: 's-wed-1', courseId: 'c-dsa-302', day: 'Wednesday', startTime: '09:00', endTime: '10:15', room: 'Turing Lab 4', type: 'Lecture', notes: 'Dynamic Programming' },
    { id: 's-wed-2', courseId: 'c-cn-303', day: 'Wednesday', startTime: '10:30', endTime: '11:45', room: 'Hall 204', type: 'Lecture', notes: 'Routing Algorithms' },
    { id: 's-wed-3', courseId: 'c-aiml-305', day: 'Wednesday', startTime: '14:00', endTime: '15:15', room: 'Innovation Hub', type: 'Lecture', notes: 'Convolutional Nets' },

    // Thursday
    { id: 's-thu-1', courseId: 'c-os-301', day: 'Thursday', startTime: '09:00', endTime: '10:15', room: 'Hall 302', type: 'Lecture', notes: 'Virtual Memory & Paging' },
    { id: 's-thu-2', courseId: 'c-dbms-304', day: 'Thursday', startTime: '10:30', endTime: '11:45', room: 'Room 105', type: 'Lecture', notes: 'ACID Transactions' },
    { id: 's-thu-3', courseId: 'c-dsa-302', day: 'Thursday', startTime: '13:30', endTime: '15:30', room: 'Turing Lab 4', type: 'Tutorial', notes: 'Graph Problems Session' },

    // Friday
    { id: 's-fri-1', courseId: 'c-cn-303', day: 'Friday', startTime: '09:00', endTime: '10:15', room: 'Hall 204', type: 'Lecture', notes: 'DNS & Application Layer' },
    { id: 's-fri-2', courseId: 'c-dbms-304', day: 'Friday', startTime: '10:30', endTime: '12:30', room: 'Database Lab', type: 'Lab', notes: 'SQL Optimization & Indexing' },
    { id: 's-fri-3', courseId: 'c-aiml-305', day: 'Friday', startTime: '14:00', endTime: '15:15', room: 'Innovation Hub', type: 'Seminar', notes: 'Transformer Architectures' },
  ];

  const today = new Date();
  const formatOffsetDate = (days: number) => {
    const d = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
    const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const tasks: Task[] = [
    {
      id: 't-1',
      courseId: 'c-os-301',
      title: 'Operating Systems Midterm Examination',
      description: 'Covers CPU scheduling, virtual memory, multithreading, and deadlock avoidance.',
      dueDate: formatOffsetDate(5),
      dueTime: '09:30',
      priority: 'urgent',
      status: 'in-progress',
      category: 'exam',
      createdAt: formatOffsetDate(-5),
      subtasks: [
        { id: 'st-1-1', title: 'Review Round-Robin and SJF scheduling problems', completed: true },
        { id: 'st-1-2', title: 'Practice virtual memory page replacement algorithms (LRU, FIFO)', completed: true },
        { id: 'st-1-3', title: 'Study Bankers algorithm and deadlock recovery methods', completed: false },
        { id: 'st-1-4', title: 'Solve 2024 past midterm exam paper', completed: false },
      ],
    },
    {
      id: 't-2',
      courseId: 'c-dsa-302',
      title: 'Implement Red-Black Tree in C++',
      description: 'Complete tree rotations, insertion balancing, and benchmark against std::map.',
      dueDate: formatOffsetDate(3),
      dueTime: '23:59',
      priority: 'high',
      status: 'todo',
      category: 'assignment',
      createdAt: formatOffsetDate(-3),
      subtasks: [
        { id: 'st-2-1', title: 'Implement node struct and left/right rotation helpers', completed: true },
        { id: 'st-2-2', title: 'Handle color flip and double-black cases on insertion', completed: false },
        { id: 'st-2-3', title: 'Write unit tests with 10,000 random keys', completed: false },
      ],
    },
    {
      id: 't-3',
      courseId: 'c-dbms-304',
      title: 'Term Project: Distributed E-Commerce Database',
      description: 'Design 3NF relational schema, partition tables, and write complex aggregation queries.',
      dueDate: formatOffsetDate(14),
      dueTime: '17:00',
      priority: 'high',
      status: 'in-progress',
      category: 'project',
      createdAt: formatOffsetDate(-7),
      subtasks: [
        { id: 'st-3-1', title: 'Create ER diagram and schema DDL with foreign keys', completed: true },
        { id: 'st-3-2', title: 'Implement full-text search indexes on catalog table', completed: true },
        { id: 'st-3-3', title: 'Write load testing script for concurrent checkout transactions', completed: false },
      ],
    },
    {
      id: 't-4',
      courseId: 'c-cn-303',
      title: 'Wireshark Packet Analysis Lab Report',
      description: 'Analyze TCP 3-way handshake and HTTP/2 multiplexing captures.',
      dueDate: formatOffsetDate(-2),
      dueTime: '18:00',
      priority: 'medium',
      status: 'completed',
      category: 'assignment',
      createdAt: formatOffsetDate(-10),
      subtasks: [
        { id: 'st-4-1', title: 'Capture pcap trace during secure HTTPS handshake', completed: true },
        { id: 'st-4-2', title: 'Document sequence numbers and window size variations', completed: true },
      ],
    },
  ];

  const attendanceRecords: AttendanceRecord[] = [
    { id: 'att-1', courseId: 'c-os-301', date: formatOffsetDate(0), status: 'present', note: 'Participated in paging discussion' },
    { id: 'att-2', courseId: 'c-dsa-302', date: formatOffsetDate(0), status: 'present', note: 'Presented graph algorithm solution' },
    { id: 'att-3', courseId: 'c-cn-303', date: formatOffsetDate(-1), status: 'absent', note: 'Doctor appointment' },
    { id: 'att-4', courseId: 'c-dbms-304', date: formatOffsetDate(-1), status: 'present' },
    { id: 'att-5', courseId: 'c-aiml-305', date: formatOffsetDate(-2), status: 'present' },
  ];

  return {
    courses,
    timeSlots,
    tasks,
    attendanceRecords,
    theme: 'dark-slate',
    activeView: 'dashboard',
  };
}
