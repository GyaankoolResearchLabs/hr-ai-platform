import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import EmployeeAttendanceLeave from "./EmployeeAttendanceLeave";

/*
|--------------------------------------------------------------------------
| EMPLOYEE ATTENDANCE & LEAVE — clock-in/out button states
|--------------------------------------------------------------------------
|
| Template for how future employee self-service page tests should be
| written: mock the page's own service module (not the raw api
| client), assert on the three mutually-exclusive clock-in/out states
| the page renders, and confirm a real button click flips the UI via
| the mocked service response — no real network/backend involved.
|--------------------------------------------------------------------------
*/

vi.mock("../services/employeeAttendanceLeaveService", () => ({
  default: {
    getAttendance: vi.fn(),
    clockIn: vi.fn(),
    clockOut: vi.fn(),
    getLeaveBalance: vi.fn(),
    getLeaveRequests: vi.fn(),
    submitLeaveRequest: vi.fn(),
  },
}));

import employeeAttendanceLeaveService from "../services/employeeAttendanceLeaveService";

function mockLoad({ today = null, attendance = [] } = {}) {
  employeeAttendanceLeaveService.getAttendance.mockResolvedValue({
    attendance,
    today,
  });
  employeeAttendanceLeaveService.getLeaveBalance.mockResolvedValue([]);
  employeeAttendanceLeaveService.getLeaveRequests.mockResolvedValue([]);
}

function renderPage() {
  return render(
    <MemoryRouter>
      <EmployeeAttendanceLeave />
    </MemoryRouter>
  );
}

describe("EmployeeAttendanceLeave — clock-in/out button states", () => {
  it("shows 'Clock In' when there is no attendance record for today", async () => {
    mockLoad({ today: null });

    renderPage();

    expect(
      await screen.findByRole("button", { name: /clock in/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /clock out/i })
    ).not.toBeInTheDocument();
  });

  it("shows the clocked-in time + 'Clock Out' button after clocking in", async () => {
    mockLoad({
      today: { attendance_date: "2026-01-15", check_in: "09:00", check_out: null },
    });

    renderPage();

    expect(
      await screen.findByRole("button", { name: /clock out/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/clocked in at/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /clock in$/i })
    ).not.toBeInTheDocument();
  });

  it("shows both times and no buttons once clocked out", async () => {
    mockLoad({
      today: {
        attendance_date: "2026-01-15",
        check_in: "09:00",
        check_out: "18:00",
      },
    });

    renderPage();

    await screen.findByText(/clocked out at/i);

    expect(
      screen.queryByRole("button", { name: /clock in/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /clock out/i })
    ).not.toBeInTheDocument();
  });

  it("clicking 'Clock In' calls the service and flips the UI to the clocked-in state", async () => {
    const user = userEvent.setup();

    mockLoad({ today: null });
    employeeAttendanceLeaveService.clockIn.mockResolvedValue({
      attendance_date: "2026-01-15",
      check_in: "09:05",
      check_out: null,
    });

    renderPage();

    const clockInButton = await screen.findByRole("button", {
      name: /clock in/i,
    });

    await user.click(clockInButton);

    await waitFor(() =>
      expect(employeeAttendanceLeaveService.clockIn).toHaveBeenCalledTimes(1)
    );

    expect(
      await screen.findByRole("button", { name: /clock out/i })
    ).toBeInTheDocument();
  });

  it("shows a clockError message and leaves the button re-clickable if clockIn fails", async () => {
    const user = userEvent.setup();

    mockLoad({ today: null });
    employeeAttendanceLeaveService.clockIn.mockRejectedValue({
      response: { data: { message: "Already clocked in elsewhere." } },
    });

    renderPage();

    const clockInButton = await screen.findByRole("button", {
      name: /clock in/i,
    });

    await user.click(clockInButton);

    expect(
      await screen.findByText("Already clocked in elsewhere.")
    ).toBeInTheDocument();

    // Still in the "not clocked in" state - button is back and enabled.
    expect(
      screen.getByRole("button", { name: /clock in/i })
    ).toBeEnabled();
  });
});
