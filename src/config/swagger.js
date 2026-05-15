const swaggerUi = require("swagger-ui-express");

const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "Maintenance Checklist API",
    version: "1.0.0",
    description:
      "Role-based API for station maintenance checklist operations with admin, staff, and supervisor modules.",
  },
  servers: [{ url: "http://localhost:5000/api", description: "Local server" }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email", example: "admin@example.com" },
          password: { type: "string", example: "Admin@123" },
        },
      },
      StationRequest: {
        type: "object",
        required: ["name", "code"],
        properties: {
          name: { type: "string", example: "Sector A" },
          code: { type: "string", example: "SEC-A" },
          description: { type: "string", example: "Main maintenance area" },
          isActive: { type: "boolean", default: true },
        },
      },
      UserRequest: {
        type: "object",
        required: ["name", "email", "password", "role"],
        properties: {
          name: { type: "string", example: "John Doe" },
          email: { type: "string", format: "email", example: "john@example.com" },
          password: { type: "string", minLength: 6, example: "Password@123" },
          role: { type: "string", enum: ["admin", "staff", "supervisor"] },
          isActive: { type: "boolean", default: true },
        },
      },
      ShiftRequest: {
        type: "object",
        required: ["stationId", "name", "startTime", "endTime", "assignmentDate"],
        properties: {
          stationId: { type: "integer", example: 1 },
          name: { type: "string", example: "Morning Shift" },
          startTime: { type: "string", example: "09:00" },
          endTime: { type: "string", example: "17:00" },
          timezone: { type: "string", default: "Asia/Kolkata" },
          assignmentDate: { type: "string", format: "date-time" },
          assignedStaffIds: { type: "array", items: { type: "integer" }, example: [2] },
          assignedSupervisorIds: { type: "array", items: { type: "integer" }, example: [3] },
        },
      },
      TemplateRequest: {
        type: "object",
        required: ["stationId", "title", "items"],
        properties: {
          stationId: { type: "integer", example: 1 },
          title: { type: "string", example: "Daily Cleaning Checklist" },
          version: { type: "integer", default: 1 },
          isActive: { type: "boolean", default: true },
          items: {
            type: "array",
            items: {
              type: "object",
              required: ["label", "displayOrder"],
              properties: {
                label: { type: "string", example: "Clean floor" },
                isMandatory: { type: "boolean", default: true },
                displayOrder: { type: "integer", example: 0 },
                inputType: { type: "string", enum: ["boolean", "text", "number"], default: "boolean" },
              },
            },
          },
        },
      },
      SubmissionRequest: {
        type: "object",
        required: ["responses"],
        properties: {
          staffRemark: { type: "string", example: "Everything looks good." },
          responses: {
            type: "array",
            items: {
              type: "object",
              required: ["templateItemId", "completed"],
              properties: {
                templateItemId: { type: "integer", example: 1 },
                completed: { type: "boolean", example: true },
                valueText: { type: "string", example: "" },
                remark: { type: "string", example: "Done early" },
              },
            },
          },
        },
      },
      ReviewRequest: {
        type: "object",
        properties: {
          supervisorComment: { type: "string", example: "Well done." },
          rejectionReason: { type: "string", example: "Items missing." },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login and receive JWT token",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } },
        },
        responses: { 200: { description: "Success" } },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current authenticated user",
        responses: { 200: { description: "Success" } },
      },
    },
    "/admin/stations": {
      get: { tags: ["Admin"], summary: "List stations", responses: { 200: { description: "Success" } } },
      post: {
        tags: ["Admin"],
        summary: "Create station",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/StationRequest" } } },
        },
        responses: { 201: { description: "Created" } },
      },
    },
    "/admin/stations/{id}": {
      put: {
        tags: ["Admin"],
        summary: "Update station",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: {
          content: { "application/json": { schema: { $ref: "#/components/schemas/StationRequest" } } },
        },
        responses: { 200: { description: "Success" } },
      },
      delete: {
        tags: ["Admin"],
        summary: "Delete station",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { 200: { description: "Success" } },
      },
    },
    "/admin/users": {
      get: { tags: ["Admin"], summary: "List users", responses: { 200: { description: "Success" } } },
      post: {
        tags: ["Admin"],
        summary: "Create user",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/UserRequest" } } },
        },
        responses: { 201: { description: "Created" } },
      },
    },
    "/admin/users/{id}": {
      put: {
        tags: ["Admin"],
        summary: "Update user",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: {
          content: { "application/json": { schema: { $ref: "#/components/schemas/UserRequest" } } },
        },
        responses: { 200: { description: "Success" } },
      },
      delete: {
        tags: ["Admin"],
        summary: "Delete user",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { 200: { description: "Success" } },
      },
    },
    "/admin/shifts": {
      get: { tags: ["Admin"], summary: "List shifts", responses: { 200: { description: "Success" } } },
      post: {
        tags: ["Admin"],
        summary: "Create shift",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ShiftRequest" } } },
        },
        responses: { 201: { description: "Created" } },
      },
    },
    "/admin/shifts/{id}": {
      put: {
        tags: ["Admin"],
        summary: "Update shift",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: {
          content: { "application/json": { schema: { $ref: "#/components/schemas/ShiftRequest" } } },
        },
        responses: { 200: { description: "Success" } },
      },
      delete: {
        tags: ["Admin"],
        summary: "Delete shift",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { 200: { description: "Success" } },
      },
    },
    "/admin/templates": {
      get: { tags: ["Admin"], summary: "List checklist templates", responses: { 200: { description: "Success" } } },
      post: {
        tags: ["Admin"],
        summary: "Create checklist template",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/TemplateRequest" } } },
        },
        responses: { 201: { description: "Created" } },
      },
    },
    "/admin/templates/{id}": {
      put: {
        tags: ["Admin"],
        summary: "Update template",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: {
          content: { "application/json": { schema: { $ref: "#/components/schemas/TemplateRequest" } } },
        },
        responses: { 200: { description: "Success" } },
      },
      delete: {
        tags: ["Admin"],
        summary: "Delete template",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { 200: { description: "Success" } },
      },
    },
    "/admin/reports/checklists": {
      get: {
        tags: ["Admin"],
        summary: "Get checklist status report",
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["draft", "submitted", "approved", "rejected"] } },
          { name: "stationId", in: "query", schema: { type: "integer" } },
          { name: "shiftId", in: "query", schema: { type: "integer" } },
        ],
        responses: { 200: { description: "Success" } },
      },
    },
    "/staff/my-shifts/today": {
      get: { tags: ["Staff"], summary: "Get current staff shifts", responses: { 200: { description: "Success" } } },
    },
    "/staff/checklists/{shiftId}": {
      get: {
        tags: ["Staff"],
        summary: "Get checklist for a shift",
        parameters: [{ name: "shiftId", in: "path", required: true, schema: { type: "integer" } }],
        responses: { 200: { description: "Success" } },
      },
    },
    "/staff/checklists/{shiftId}/submit": {
      post: {
        tags: ["Staff"],
        summary: "Submit completed checklist",
        parameters: [{ name: "shiftId", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/SubmissionRequest" } } },
        },
        responses: { 201: { description: "Created" } },
      },
    },
    "/supervisor/submissions": {
      get: {
        tags: ["Supervisor"],
        summary: "Get submissions for verification",
        parameters: [{ name: "status", in: "query", schema: { type: "string", default: "submitted" } }],
        responses: { 200: { description: "Success" } },
      },
    },
    "/supervisor/submissions/{id}/approve": {
      post: {
        tags: ["Supervisor"],
        summary: "Approve a submitted checklist",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: {
          content: { "application/json": { schema: { $ref: "#/components/schemas/ReviewRequest" } } },
        },
        responses: { 200: { description: "Success" } },
      },
    },
    "/supervisor/submissions/{id}/reject": {
      post: {
        tags: ["Supervisor"],
        summary: "Reject a submitted checklist",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: {
          content: { "application/json": { schema: { $ref: "#/components/schemas/ReviewRequest" } } },
        },
        responses: { 200: { description: "Success" } },
      },
    },
    "/supervisor/history": {
      get: {
        tags: ["Supervisor"],
        summary: "Get shift-wise checklist history",
        parameters: [
          { name: "shiftId", in: "query", schema: { type: "integer" } },
          { name: "date", in: "query", schema: { type: "string", format: "date" }, description: "YYYY-MM-DD" },
        ],
        responses: { 200: { description: "Success" } },
      },
    },
  },
};

function setupSwagger(app) {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

module.exports = setupSwagger;

