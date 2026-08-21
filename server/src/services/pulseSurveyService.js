import { supabaseAdmin } from "../config/supabase.js";

/* =========================================================
   HELPERS
========================================================= */

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeQuestion(question, index = 0) {
  if (!question?.question_text?.trim()) {
    throw createError(
      `Question ${index + 1} text is required.`,
      400,
    );
  }

  const allowedTypes = [
    "text",
    "rating",
    "single_choice",
    "multiple_choice",
  ];

  const questionType =
    question.question_type || "text";

  if (!allowedTypes.includes(questionType)) {
    throw createError(
      `Invalid question type for question ${index + 1}.`,
      400,
    );
  }

  let options = null;

  if (
    questionType === "single_choice" ||
    questionType === "multiple_choice"
  ) {
    if (
      !Array.isArray(question.options) ||
      question.options.length === 0
    ) {
      throw createError(
        `Options are required for question ${index + 1}.`,
        400,
      );
    }

    options = question.options
      .map((option) =>
        typeof option === "string"
          ? option.trim()
          : String(option),
      )
      .filter(Boolean);

    if (options.length === 0) {
      throw createError(
        `At least one valid option is required for question ${index + 1}.`,
        400,
      );
    }
  }

  return {
    question_text:
      question.question_text.trim(),

    question_type: questionType,

    options,

    display_order:
      Number.isInteger(question.display_order)
        ? question.display_order
        : index,

    required:
      question.required !== false,
  };
}

async function verifyEmployeeBelongsToOrganization(
  organizationId,
  employeeId,
) {
  if (!employeeId) {
    throw createError(
      "Employee ID is required.",
      400,
    );
  }

  const { data, error } =
    await supabaseAdmin
      .from("employees")
      .select("id, full_name, email, department, title")
      .eq("organization_id", organizationId)
      .eq("id", employeeId)
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw createError(
      "Employee does not belong to this organization.",
      404,
    );
  }

  return data;
}

/* =========================================================
   GET ALL SURVEYS
========================================================= */

export async function getPulseSurveys({
  organizationId,
  status = null,
}) {
  if (!organizationId) {
    throw createError(
      "Organization ID is required.",
      400,
    );
  }

  let query = supabaseAdmin
    .from("pulse_surveys")
    .select(`
      *,
      pulse_survey_questions (
        id,
        question_text,
        question_type,
        options,
        display_order,
        required
      )
    `)
    .eq("organization_id", organizationId)
    .order("created_at", {
      ascending: false,
    });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data || [];
}

/* =========================================================
   GET SINGLE SURVEY
========================================================= */

export async function getPulseSurveyById(
  organizationId,
  surveyId,
) {
  if (!organizationId) {
    throw createError(
      "Organization ID is required.",
      400,
    );
  }

  if (!surveyId) {
    throw createError(
      "Survey ID is required.",
      400,
    );
  }

  const { data, error } =
    await supabaseAdmin
      .from("pulse_surveys")
      .select(`
        *,
        pulse_survey_questions (
          id,
          question_text,
          question_type,
          options,
          display_order,
          required
        )
      `)
      .eq("organization_id", organizationId)
      .eq("id", surveyId)
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw createError(
      "Pulse survey not found.",
      404,
    );
  }

  if (
    Array.isArray(
      data.pulse_survey_questions,
    )
  ) {
    data.pulse_survey_questions.sort(
      (a, b) =>
        a.display_order -
        b.display_order,
    );
  }

  return data;
}

/* =========================================================
   CREATE SURVEY
========================================================= */

export async function createPulseSurvey({
  organizationId,
  createdByUserId,
  title,
  description,
  isAnonymous = true,
  startsAt = null,
  endsAt = null,
  questions = [],
}) {
  if (!organizationId) {
    throw createError(
      "Organization ID is required.",
      400,
    );
  }

  if (!createdByUserId) {
    throw createError(
      "Creator user ID is required.",
      400,
    );
  }

  if (!title?.trim()) {
    throw createError(
      "Survey title is required.",
      400,
    );
  }

  if (
    !Array.isArray(questions) ||
    questions.length === 0
  ) {
    throw createError(
      "At least one survey question is required.",
      400,
    );
  }

  const normalizedQuestions =
    questions.map(normalizeQuestion);

  if (
    startsAt &&
    endsAt &&
    new Date(endsAt) <=
      new Date(startsAt)
  ) {
    throw createError(
      "Survey end time must be after the start time.",
      400,
    );
  }

  const { data: survey, error: surveyError } =
    await supabaseAdmin
      .from("pulse_surveys")
      .insert({
        organization_id:
          organizationId,

        created_by_user_id:
          createdByUserId,

        title: title.trim(),

        description:
          description?.trim() || null,

        status: "draft",

        is_anonymous:
          isAnonymous !== false,

        starts_at:
          startsAt || null,

        ends_at:
          endsAt || null,
      })
      .select("*")
      .single();

  if (surveyError) {
    throw surveyError;
  }

  const questionRows =
    normalizedQuestions.map(
      (question) => ({
        survey_id: survey.id,
        ...question,
      }),
    );

  const {
    data: createdQuestions,
    error: questionsError,
  } = await supabaseAdmin
    .from("pulse_survey_questions")
    .insert(questionRows)
    .select("*");

  if (questionsError) {
    await supabaseAdmin
      .from("pulse_surveys")
      .delete()
      .eq("id", survey.id)
      .eq(
        "organization_id",
        organizationId,
      );

    throw questionsError;
  }

  return {
    ...survey,
    pulse_survey_questions:
      createdQuestions || [],
  };
}

/* =========================================================
   UPDATE SURVEY
========================================================= */

export async function updatePulseSurvey(
  organizationId,
  surveyId,
  updates = {},
) {
  const existing =
    await getPulseSurveyById(
      organizationId,
      surveyId,
    );

  if (
    existing.status !== "draft"
  ) {
    throw createError(
      "Only draft surveys can be edited.",
      400,
    );
  }

  const allowedFields = [
    "title",
    "description",
    "is_anonymous",
    "starts_at",
    "ends_at",
  ];

  const cleanUpdates = {};

  for (const field of allowedFields) {
    if (
      Object.prototype.hasOwnProperty.call(
        updates,
        field,
      )
    ) {
      cleanUpdates[field] =
        updates[field];
    }
  }

  if (
    Object.keys(cleanUpdates).length ===
    0
  ) {
    throw createError(
      "No valid survey updates were provided.",
      400,
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      cleanUpdates,
      "title",
    )
  ) {
    if (
      !cleanUpdates.title?.trim()
    ) {
      throw createError(
        "Survey title is required.",
        400,
      );
    }

    cleanUpdates.title =
      cleanUpdates.title.trim();
  }

  if (
    cleanUpdates.starts_at &&
    cleanUpdates.ends_at &&
    new Date(cleanUpdates.ends_at) <=
      new Date(cleanUpdates.starts_at)
  ) {
    throw createError(
      "Survey end time must be after the start time.",
      400,
    );
  }

  cleanUpdates.updated_at =
    new Date().toISOString();

  const { data, error } =
    await supabaseAdmin
      .from("pulse_surveys")
      .update(cleanUpdates)
      .eq("organization_id", organizationId)
      .eq("id", surveyId)
      .select("*")
      .single();

  if (error) {
    throw error;
  }

  return getPulseSurveyById(
    organizationId,
    data.id,
  );
}

/* =========================================================
   PUBLISH SURVEY
========================================================= */

export async function publishPulseSurvey(
  organizationId,
  surveyId,
) {
  const survey =
    await getPulseSurveyById(
      organizationId,
      surveyId,
    );

  if (survey.status !== "draft") {
    throw createError(
      "Only draft surveys can be published.",
      400,
    );
  }

  if (
    !survey.pulse_survey_questions?.length
  ) {
    throw createError(
      "A survey must contain at least one question before publishing.",
      400,
    );
  }

  const { data, error } =
    await supabaseAdmin
      .from("pulse_surveys")
      .update({
        status: "published",
        updated_at:
          new Date().toISOString(),
      })
      .eq("organization_id", organizationId)
      .eq("id", surveyId)
      .select("*")
      .single();

  if (error) {
    throw error;
  }

  return data;
}

/* =========================================================
   CLOSE SURVEY
========================================================= */

export async function closePulseSurvey(
  organizationId,
  surveyId,
) {
  const survey =
    await getPulseSurveyById(
      organizationId,
      surveyId,
    );

  if (survey.status !== "published") {
    throw createError(
      "Only published surveys can be closed.",
      400,
    );
  }

  const { data, error } =
    await supabaseAdmin
      .from("pulse_surveys")
      .update({
        status: "closed",
        updated_at:
          new Date().toISOString(),
      })
      .eq("organization_id", organizationId)
      .eq("id", surveyId)
      .select("*")
      .single();

  if (error) {
    throw error;
  }

  return data;
}

/* =========================================================
   SUBMIT RESPONSE
========================================================= */

export async function submitPulseSurveyResponse({
  organizationId,
  surveyId,
  employeeId,
  answers = [],
}) {
  const survey =
    await getPulseSurveyById(
      organizationId,
      surveyId,
    );

  if (survey.status !== "published") {
    throw createError(
      "This survey is not currently accepting responses.",
      400,
    );
  }

  if (
    survey.starts_at &&
    new Date() <
      new Date(survey.starts_at)
  ) {
    throw createError(
      "This survey has not started yet.",
      400,
    );
  }

  if (
    survey.ends_at &&
    new Date() >
      new Date(survey.ends_at)
  ) {
    throw createError(
      "This survey has ended.",
      400,
    );
  }

  if (!survey.is_anonymous) {
    await verifyEmployeeBelongsToOrganization(
      organizationId,
      employeeId,
    );
  }

  if (
    !Array.isArray(answers) ||
    answers.length === 0
  ) {
    throw createError(
      "At least one answer is required.",
      400,
    );
  }

  const questionMap =
    new Map(
      (
        survey.pulse_survey_questions ||
        []
      ).map((question) => [
        question.id,
        question,
      ]),
    );

  const answerRows = [];

  for (const answer of answers) {
    const question =
      questionMap.get(
        answer.question_id ||
          answer.questionId,
      );

    if (!question) {
      throw createError(
        "One or more answers reference an invalid question.",
        400,
      );
    }

    const row = {
      question_id:
        question.id,

      answer_text:
        answer.answer_text ??
        answer.answerText ??
        null,

      answer_value:
        answer.answer_value ??
        answer.answerValue ??
        null,

      answer_options:
        answer.answer_options ??
        answer.answerOptions ??
        null,
    };

    if (
      question.required &&
      !row.answer_text &&
      row.answer_value === null &&
      !row.answer_options
    ) {
      throw createError(
        `Answer required for question: ${question.question_text}`,
        400,
      );
    }

    answerRows.push(row);
  }

  const responsePayload = {
    survey_id: surveyId,
    employee_id:
      survey.is_anonymous
        ? null
        : employeeId || null,
  };

  const {
    data: response,
    error: responseError,
  } = await supabaseAdmin
    .from("pulse_survey_responses")
    .insert(responsePayload)
    .select("*")
    .single();

  if (responseError) {
    throw responseError;
  }

  const rowsWithResponseId =
    answerRows.map((answer) => ({
      response_id: response.id,
      ...answer,
    }));

  const {
    data: createdAnswers,
    error: answersError,
  } = await supabaseAdmin
    .from("pulse_survey_answers")
    .insert(rowsWithResponseId)
    .select("*");

  if (answersError) {
    await supabaseAdmin
      .from("pulse_survey_responses")
      .delete()
      .eq("id", response.id);

    throw answersError;
  }

  return {
    response,
    answers: createdAnswers || [],
  };
}

/* =========================================================
   RESULTS
========================================================= */

export async function getPulseSurveyResults(
  organizationId,
  surveyId,
) {
  const survey =
    await getPulseSurveyById(
      organizationId,
      surveyId,
    );

  const { data: responses, error } =
    await supabaseAdmin
      .from("pulse_survey_responses")
      .select(`
        id,
        survey_id,
        employee_id,
        submitted_at,
        sentiment_label,
        sentiment_score,
        pulse_survey_answers (
          id,
          question_id,
          answer_text,
          answer_value,
          answer_options
        )
      `)
      .eq("survey_id", surveyId)
      .order("submitted_at", {
        ascending: false,
      });

  if (error) {
    throw error;
  }

  const responseRows =
    responses || [];

  const totalResponses =
    responseRows.length;

  const sentimentCounts = {
    positive: 0,
    neutral: 0,
    negative: 0,
    unclassified: 0,
  };

  let sentimentScoreTotal = 0;
  let sentimentScoreCount = 0;

  for (const response of responseRows) {
    if (
      response.sentiment_label &&
      Object.prototype.hasOwnProperty.call(
        sentimentCounts,
        response.sentiment_label,
      )
    ) {
      sentimentCounts[
        response.sentiment_label
      ] += 1;
    } else {
      sentimentCounts.unclassified += 1;
    }

    if (
      response.sentiment_score !==
        null &&
      response.sentiment_score !==
        undefined
    ) {
      sentimentScoreTotal += Number(
        response.sentiment_score,
      );

      sentimentScoreCount += 1;
    }
  }

  const questionStats =
    (
      survey.pulse_survey_questions ||
      []
    ).map((question) => {
      const answers = [];

      for (const response of responseRows) {
        const answer =
          response.pulse_survey_answers?.find(
            (item) =>
              item.question_id ===
              question.id,
          );

        if (answer) {
          answers.push(answer);
        }
      }

      let ratingTotal = 0;
      let ratingCount = 0;

      for (const answer of answers) {
        if (
          answer.answer_value !==
            null &&
          answer.answer_value !==
            undefined
        ) {
          ratingTotal += Number(
            answer.answer_value,
          );

          ratingCount += 1;
        }
      }

      return {
        questionId: question.id,
        questionText:
          question.question_text,
        questionType:
          question.question_type,
        responseCount:
          answers.length,
        averageRating:
          ratingCount > 0
            ? Number(
                (
                  ratingTotal /
                  ratingCount
                ).toFixed(2),
              )
            : null,
      };
    });

  return {
    survey: {
      id: survey.id,
      title: survey.title,
      description:
        survey.description,
      status: survey.status,
      is_anonymous:
        survey.is_anonymous,
      starts_at:
        survey.starts_at,
      ends_at:
        survey.ends_at,
    },

    totalResponses,

    sentiment: {
      positive:
        sentimentCounts.positive,
      neutral:
        sentimentCounts.neutral,
      negative:
        sentimentCounts.negative,
      unclassified:
        sentimentCounts.unclassified,
      averageScore:
        sentimentScoreCount > 0
          ? Number(
              (
                sentimentScoreTotal /
                sentimentScoreCount
              ).toFixed(2),
            )
          : null,
    },

    questionStats,

    responses: responseRows,
  };
}