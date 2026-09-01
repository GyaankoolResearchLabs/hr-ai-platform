import express from "express";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| TEST HR API
|--------------------------------------------------------------------------
|
| This endpoint simulates an external HR system.
|
| It is intentionally kept separate from the real employee API.
|
| Integration Hub will call this endpoint during development/testing
| exactly like it would call BambooHR, Workday, etc.
|
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| GET /api/test-hr/employees
|--------------------------------------------------------------------------
*/

router.get("/employees", async (req, res) => {
  try {
    const employees = [
      {
        employee_id: "EMP001",
        name: "John Smith",
        email: "john.smith@example.com",
        department: "Engineering",
        title: "Software Engineer",
        joining_date: "2025-01-15",
        employment_status: "Active",
        last_working_date: null,
        address: "Bengaluru",
      },

      {
        employee_id: "EMP002",
        name: "Sarah Williams",
        email: "sarah.williams@example.com",
        department: "Human Resources",
        title: "HR Manager",
        joining_date: "2024-08-12",
        employment_status: "Active",
        last_working_date: null,
        address: "Mumbai",
      },

      {
        employee_id: "EMP003",
        name: "Michael Brown",
        email: "michael.brown@example.com",
        department: "Finance",
        title: "Financial Analyst",
        joining_date: "2025-03-10",
        employment_status: "Active",
        last_working_date: null,
        address: "Pune",
      },

      {
        employee_id: "EMP004",
        name: "Emily Davis",
        email: "emily.davis@example.com",
        department: "Marketing",
        title: "Marketing Specialist",
        joining_date: "2024-11-04",
        employment_status: "Active",
        last_working_date: null,
        address: "Hyderabad",
      },

      {
        employee_id: "EMP005",
        name: "David Wilson",
        email: "david.wilson@example.com",
        department: "Operations",
        title: "Operations Manager",
        joining_date: "2023-06-19",
        employment_status: "Active",
        last_working_date: null,
        address: "Chennai",
      },
    ];

    return res.status(200).json({
      success: true,

      provider: "Test HR System",

      count: employees.length,

      employees,
    });
  } catch (error) {
    console.error(
      "[TEST HR API] Failed to return employees:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Test HR API failed.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET /api/test-hr
|--------------------------------------------------------------------------
|
| Simple health endpoint so we can verify that the test HR system
| is running.
|
|--------------------------------------------------------------------------
*/

router.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    provider: "Test HR System",
    message: "Test HR API is running.",
  });
});

export default router;