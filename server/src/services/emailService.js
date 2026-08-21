import { Resend } from "resend";

/*
|--------------------------------------------------------------------------
| HR DOCUMENT EMAIL SERVICE
|--------------------------------------------------------------------------
|
| Required environment variables:
|
| RESEND_API_KEY
| EMAIL_FROM
|
| Example:
|
| RESEND_API_KEY=re_xxxxxxxxx
| EMAIL_FROM="SkillOS <onboarding@resend.dev>"
|
|--------------------------------------------------------------------------
*/

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not configured. Add it to server/.env."
    );
  }

  return new Resend(apiKey);
}

/* =========================================================
   HTML ESCAPE
========================================================= */

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* =========================================================
   DOCUMENT TYPE LABEL
========================================================= */

function documentTypeLabel(type) {
  return String(type || "hr_document")
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}

/* =========================================================
   BUILD DOCUMENT HTML
========================================================= */

function buildDocumentHtml({
  employeeName,
  organizationName,
  title,
  documentData,
}) {
  const content =
    documentData?.content || {};

  /*
   * If a custom organization template has already
   * generated rendered content, preserve it.
   */

  const renderedContent =
    content?.rendered_content;

  if (
    typeof renderedContent === "string" &&
    renderedContent.trim()
  ) {
    const safeRendered =
      escapeHtml(renderedContent)
        .replaceAll("\n", "<br />");

    return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />

  <title>${escapeHtml(title)}</title>

  <style>
    body {
      margin: 0;
      padding: 40px;
      background: #f5f7f7;
      font-family:
        Arial,
        Helvetica,
        sans-serif;
      color: #183b3a;
    }

    .page {
      max-width: 760px;
      margin: 0 auto;
      background: #ffffff;
      padding: 56px;
      border: 1px solid #dce7e6;
      box-sizing: border-box;
    }

    .header {
      text-align: center;
      font-size: 26px;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .company {
      text-align: center;
      color: #647777;
      margin-bottom: 30px;
    }

    .rule {
      border-top: 1px solid #176b68;
      margin-bottom: 30px;
    }

    .content {
      line-height: 1.8;
      font-size: 15px;
    }

    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #176b68;
      text-align: center;
      color: #647777;
      font-size: 12px;
    }
  </style>
</head>

<body>

  <div class="page">

    <div class="header">
      ${escapeHtml(organizationName)}
    </div>

    <div class="company">
      ${escapeHtml(title)}
    </div>

    <div class="rule"></div>

    <div class="content">
      ${safeRendered}
    </div>

    <div class="footer">
      Confidential HR Document
    </div>

  </div>

</body>
</html>
`;
  }

  /*
   * Standard system-generated document.
   */

  const fields = [
    "date",
    "greeting",
    "recipient_address",
    "subject",
    "introduction",
    "joining_statement",
    "employment_period",
    "duration",
    "verification_statement",
    "position_statement",
    "employment_status_statement",
    "last_working_statement",
    "employee_statement",
    "employment_statement",
    "address_statement",
    "employee_identification",
    "responsibilities",
    "conduct",
    "closing",
  ];

  const paragraphs = fields
    .filter((field) => content[field])
    .map(
      (field) => `
        <p>
          ${escapeHtml(content[field])}
        </p>
      `
    )
    .join("");

  const signatoryName =
    content.signatory_name ||
    "HR Department";

  const signatoryDesignation =
    content.signatory_designation ||
    "";

  return `
<!doctype html>
<html>
<head>

  <meta charset="utf-8" />

  <title>${escapeHtml(title)}</title>

  <style>

    body {
      margin: 0;
      padding: 40px;
      background: #f5f7f7;
      font-family:
        Arial,
        Helvetica,
        sans-serif;
      color: #183b3a;
    }

    .page {
      max-width: 760px;
      margin: 0 auto;
      background: #ffffff;
      padding: 56px;
      border: 1px solid #dce7e6;
      box-sizing: border-box;
    }

    .header {
      text-align: center;
      font-size: 26px;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .company {
      text-align: center;
      color: #647777;
      margin-bottom: 30px;
    }

    .rule {
      border-top: 1px solid #176b68;
      margin-bottom: 30px;
    }

    p {
      line-height: 1.8;
      margin: 0 0 20px;
    }

    .signatory {
      margin-top: 50px;
      line-height: 1.6;
    }

    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #176b68;
      text-align: center;
      color: #647777;
      font-size: 12px;
    }

  </style>

</head>

<body>

  <div class="page">

    <div class="header">
      ${escapeHtml(organizationName)}
    </div>

    <div class="company">
      ${escapeHtml(title)}
    </div>

    <div class="rule"></div>

    ${paragraphs}

    <div class="signatory">

      <strong>
        ${escapeHtml(signatoryName)}
      </strong>

      ${
        signatoryDesignation
          ? `<br />${escapeHtml(signatoryDesignation)}`
          : ""
      }

    </div>

    <div class="footer">
      Confidential HR Document
    </div>

  </div>

</body>
</html>
`;
}

/* =========================================================
   BUILD PLAIN TEXT EMAIL
========================================================= */

function buildPlainText({
  employeeName,
  organizationName,
  title,
  documentData,
}) {
  const content =
    documentData?.content || {};

  const lines = [
    organizationName,
    title,
    "",
    `Employee: ${employeeName}`,
    "",
  ];

  const fields = [
    "date",
    "greeting",
    "recipient_address",
    "subject",
    "introduction",
    "joining_statement",
    "employment_period",
    "duration",
    "verification_statement",
    "position_statement",
    "employment_status_statement",
    "last_working_statement",
    "employee_statement",
    "employment_statement",
    "address_statement",
    "employee_identification",
    "responsibilities",
    "conduct",
    "closing",
  ];

  for (const field of fields) {
    if (content[field]) {
      lines.push(
        String(content[field])
      );

      lines.push("");
    }
  }

  if (content.signatory_name) {
    lines.push(
      String(content.signatory_name)
    );
  }

  if (content.signatory_designation) {
    lines.push(
      String(
        content.signatory_designation
      )
    );
  }

  return lines.join("\n");
}

/* =========================================================
   SEND GENERATED DOCUMENT
========================================================= */

export async function sendGeneratedDocumentEmail({
  to,
  employeeName,
  organizationName,
  documentType,
  title,
  documentData,
}) {
  if (!to) {
    throw new Error(
      "Employee email address is required."
    );
  }

  if (!employeeName) {
    employeeName = "Employee";
  }

  if (!organizationName) {
    organizationName = "Organization";
  }

  if (!title) {
    title = "HR Document";
  }

  const resend =
    getResendClient();

  const label =
    documentTypeLabel(
      documentType
    );

  const html =
    buildDocumentHtml({
      employeeName,
      organizationName,
      title,
      documentData,
    });

  const text =
    buildPlainText({
      employeeName,
      organizationName,
      title,
      documentData,
    });

  const from =
    process.env.EMAIL_FROM;

  if (!from) {
    throw new Error(
      "EMAIL_FROM is not configured. Add EMAIL_FROM to server/.env."
    );
  }

  /*
   * Resend supports attachments directly.
   *
   * For the first production step we attach the
   * generated document as HTML.
   *
   * We will upgrade this to a real PDF attachment
   * immediately after confirming email delivery works.
   */

  const safeEmployeeName =
    employeeName
      .replace(
        /[^a-zA-Z0-9_-]/g,
        "_"
      );

  const filename =
    `${label.replaceAll(
      " ",
      "_"
    )}_${safeEmployeeName}.html`;

  const result =
    await resend.emails.send({
      from,

      to: [to],

      subject:
        `${label} – ${employeeName}`,

      text,

      html,

      attachments: [
        {
          filename,

          content:
            Buffer.from(
              html,
              "utf8"
            ),
        },
      ],
    });

  if (result?.error) {
    console.error(
      "Resend email error:",
      result.error
    );

    throw new Error(
      result.error.message ||
        "Resend could not send the email."
    );
  }

  console.log(
    `HR document sent successfully to ${to}`
  );

  console.log(
    "Resend message ID:",
    result?.data?.id || null
  );

  return {
    messageId:
      result?.data?.id || null,
  };
}