// ─────────────────────────────────────────────────────────────
// backend/src/modules/auth/auth.queries.js
// SQL statements for user authentication and subclass profiles
// ─────────────────────────────────────────────────────────────

export const authQueries = {
  insertUser: `
    INSERT INTO users (email, password_hash, first_name, last_name, phone, user_type)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING user_id, email, first_name, last_name, phone, user_type, created_at;
  `,

  insertStudent: `
    INSERT INTO student (user_id, roll_no, year_of_study)
    VALUES ($1, $2, $3);
  `,

  insertFaculty: `
    INSERT INTO faculty (user_id, employee_id, department)
    VALUES ($1, $2, $3);
  `,

  insertGuest: `
    INSERT INTO guest (user_id, affiliation)
    VALUES ($1, $2);
  `,

  findUserByEmail: `
    SELECT user_id, email, password_hash, first_name, last_name, phone, user_type, created_at
    FROM users
    WHERE email = $1;
  `,

  findUserProfile: `
    SELECT
      u.user_id,
      u.email,
      u.first_name,
      u.last_name,
      u.phone,
      u.user_type,
      u.created_at,
      s.roll_no,
      s.year_of_study,
      f.employee_id,
      f.department,
      g.affiliation
    FROM users u
    LEFT JOIN student s ON u.user_id = s.user_id
    LEFT JOIN faculty f ON u.user_id = f.user_id
    LEFT JOIN guest g ON u.user_id = g.user_id
    WHERE u.user_id = $1;
  `,

  findManagedClubs: `
    SELECT club_id, role
    FROM club_manager
    WHERE user_id = $1;
  `,
};
