-- Seed initial data for local PostgreSQL database 'academiasync'

-- 1. Insert User
INSERT INTO users (id, email, full_name, college_name, branch, semester, target_attendance_percentage)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'alex.rivera@college.edu',
    'Alex Rivera',
    'Apex Institute of Technology',
    'Computer Science & Engineering',
    'Semester 5',
    75.00
) ON CONFLICT (email) DO NOTHING;

-- 2. Insert Courses
INSERT INTO courses (id, user_id, code, name, professor, default_room, color_hex, credits, attendance_goal, total_classes_held, attended_classes)
VALUES 
('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'CS501', 'Operating Systems', 'Dr. Aris Thorne', 'Hall 302', '#3b82f6', 4, 75, 28, 24),
('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'CS502', 'Design & Analysis of Algorithms', 'Prof. Sarah Jenkins', 'Lab 4B', '#8b5cf6', 4, 75, 30, 22),
('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'CS503', 'Computer Networks', 'Dr. Marcus Vance', 'Room 205', '#10b981', 3, 75, 25, 20),
('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'CS504', 'Database Management & Cloud', 'Prof. Elena Rostova', 'Hall 101', '#f59e0b', 4, 75, 26, 18),
('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'CS505', 'Artificial Intelligence & ML', 'Dr. Kenji Sato', 'AI Center', '#ec4899', 3, 80, 24, 21),
('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'HU501', 'Tech Communication & Ethics', 'Dr. Maya Patel', 'Seminar Room 2', '#06b6d4', 2, 75, 18, 16)
ON CONFLICT (id) DO NOTHING;

-- 3. Insert Time Slots
INSERT INTO time_slots (course_id, user_id, day_of_week, start_time, end_time, room, slot_type, notes)
VALUES
('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Monday', '09:00', '10:00', 'Hall 302', 'Lecture', NULL),
('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Monday', '10:15', '11:15', 'Hall 201', 'Lecture', NULL),
('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Monday', '11:30', '12:30', 'Hall 101', 'Lecture', NULL),
('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Monday', '13:30', '15:30', 'Lab 4B', 'Lab', 'Dynamic Programming practice'),

('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Tuesday', '09:00', '10:00', 'Room 205', 'Lecture', NULL),
('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Tuesday', '10:15', '11:15', 'AI Center', 'Lecture', NULL),
('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Tuesday', '11:30', '12:30', 'Hall 302', 'Lecture', NULL),
('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'Tuesday', '14:00', '15:00', 'Seminar Room 2', 'Seminar', NULL),

('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Wednesday', '09:00', '10:00', 'Hall 201', 'Lecture', NULL),
('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Wednesday', '10:15', '11:15', 'Hall 101', 'Lecture', NULL),
('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Wednesday', '11:30', '12:30', 'Room 205', 'Lecture', NULL),
('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Wednesday', '13:30', '15:30', 'OS Systems Lab', 'Lab', 'Kernel compilation'),

('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Thursday', '09:00', '10:00', 'AI Center', 'Lecture', NULL),
('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Thursday', '10:15', '11:15', 'Room 205', 'Tutorial', NULL),
('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Thursday', '11:30', '12:30', 'Hall 302', 'Lecture', NULL),
('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Thursday', '13:30', '15:30', 'DB Lab 2', 'Lab', 'PostgreSQL indexing workshop'),

('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Friday', '09:00', '10:00', 'Hall 201', 'Lecture', NULL),
('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Friday', '10:15', '12:15', 'AI Center', 'Lab', 'PyTorch CNNs'),
('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'Friday', '13:30', '14:30', 'Seminar Room 2', 'Tutorial', NULL);

-- 4. Insert Tasks & Exams
INSERT INTO tasks (user_id, course_id, title, description, due_date, due_time, priority, status, category)
VALUES
('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Operating Systems - Deadlock & Semaphores Assignment', 'Implement Banker algorithm in C', CURRENT_DATE + INTERVAL '3 days', '23:59:00', 'high', 'in-progress', 'assignment'),
('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Algorithms Midterm Examination', 'Greedy algorithms, Dynamic Programming, and MST', CURRENT_DATE + INTERVAL '7 days', '10:00:00', 'urgent', 'todo', 'exam'),
('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'PostgreSQL Database Performance Benchmark Report', 'Compare B-Tree vs Hash indexing', CURRENT_DATE + INTERVAL '14 days', '17:00:00', 'medium', 'todo', 'project');
