import {
  createGeneratedCourse,
  getCourse,
  getCourses,
  publishCourse,
} from "../services/learningService.js";

/* =========================================================
   HELPERS
========================================================= */

function getOrganizationId(req) {
  return (
    req.user?.organization_id ||
    req.user?.organizationId ||
    null
  );
}

/* =========================================================
   GET COURSES
========================================================= */

export async function getCoursesController(
  req,
  res,
) {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(403).json({
        message:
          "Authenticated user is not associated with an organization.",
      });
    }

    const courses =
      await getCourses(
        organizationId,
      );

    return res.status(200).json({
      courses,
    });
  } catch (error) {
    console.error(
      "[Learning] GET courses failed:",
      error,
    );

    return res.status(
      error?.statusCode || 500,
    ).json({
      message:
        error?.message ||
        "Failed to load courses.",
    });
  }
}

/* =========================================================
   GET SINGLE COURSE
========================================================= */

export async function getCourseController(
  req,
  res,
) {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(403).json({
        message:
          "Authenticated user is not associated with an organization.",
      });
    }

    const course =
      await getCourse(
        organizationId,
        req.params.id,
      );

    return res.status(200).json({
      course,
    });
  } catch (error) {
    console.error(
      "[Learning] GET course failed:",
      error,
    );

    return res.status(
      error?.statusCode || 500,
    ).json({
      message:
        error?.message ||
        "Failed to load course.",
    });
  }
}

/* =========================================================
   CREATE GENERATED COURSE
========================================================= */

export async function generateCourseController(
  req,
  res,
) {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(403).json({
        message:
          "Authenticated user is not associated with an organization.",
      });
    }

    const userId =
      req.user?.id;

    const {
      source,
      course,
    } = req.body || {};

    if (!course) {
      return res.status(400).json({
        message:
          "Generated course data is required.",
      });
    }

    const createdCourse =
      await createGeneratedCourse({
        organizationId,
        userId,
        source,
        generatedCourse: course,
      });

    return res.status(201).json({
      message:
        "Course created successfully.",
      course: createdCourse,
    });
  } catch (error) {
    console.error(
      "[Learning] GENERATE course failed:",
      error,
    );

    return res.status(
      error?.statusCode || 500,
    ).json({
      message:
        error?.message ||
        "Failed to create course.",
    });
  }
}

/* =========================================================
   PUBLISH COURSE
========================================================= */

export async function publishCourseController(
  req,
  res,
) {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(403).json({
        message:
          "Authenticated user is not associated with an organization.",
      });
    }

    const course =
      await publishCourse(
        organizationId,
        req.params.id,
      );

    return res.status(200).json({
      message:
        "Course published successfully.",
      course,
    });
  } catch (error) {
    console.error(
      "[Learning] PUBLISH course failed:",
      error,
    );

    return res.status(
      error?.statusCode || 500,
    ).json({
      message:
        error?.message ||
        "Failed to publish course.",
    });
  }
}