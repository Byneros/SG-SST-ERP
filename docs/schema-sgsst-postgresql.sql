-- SG-SST PostgreSQL database schema
-- Target: PostgreSQL 14+
-- Design goals: multi-tenant isolation, normalized core catalogs, auditability,
-- document/evidence traceability, and extensibility for Colombian SG-SST flows.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- ============================================================================
-- Enumerated domains
-- ============================================================================

CREATE TYPE user_status AS ENUM ('ACTIVE', 'INACTIVE', 'LOCKED', 'PENDING');
CREATE TYPE employment_status AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'RETIRED');
CREATE TYPE evidence_owner_type AS ENUM (
  'DOCUMENT',
  'TRAINING',
  'INCIDENT',
  'AUDIT',
  'RISK',
  'INSPECTION',
  'ACTION',
  'EVALUATION'
);
CREATE TYPE document_status AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED', 'VOID');
CREATE TYPE workflow_status AS ENUM ('DRAFT', 'OPEN', 'IN_PROGRESS', 'PENDING_REVIEW', 'CLOSED', 'CANCELLED');
CREATE TYPE action_status AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_EVIDENCE', 'PENDING_VERIFICATION', 'EFFECTIVE', 'NOT_EFFECTIVE', 'CLOSED');
CREATE TYPE risk_level AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE incident_type AS ENUM ('INCIDENT', 'ACCIDENT', 'NEAR_MISS', 'OCCUPATIONAL_DISEASE');
CREATE TYPE incident_status AS ENUM ('REPORTED', 'CLASSIFIED', 'UNDER_INVESTIGATION', 'ACTION_PLAN', 'CLOSED', 'VOID');
CREATE TYPE audit_status AS ENUM ('PLANNED', 'IN_PROGRESS', 'REPORT_PENDING', 'CLOSED', 'CANCELLED');
CREATE TYPE finding_type AS ENUM ('CONFORMITY', 'OBSERVATION', 'OPPORTUNITY', 'MINOR_NONCONFORMITY', 'MAJOR_NONCONFORMITY');
CREATE TYPE training_status AS ENUM ('PLANNED', 'OPEN_REGISTRATION', 'COMPLETED', 'CANCELLED');
CREATE TYPE attendance_status AS ENUM ('INVITED', 'ATTENDED', 'ABSENT', 'EXCUSED', 'APPROVED', 'FAILED');
CREATE TYPE evaluation_status AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'APPROVED');
CREATE TYPE external_delivery_provider AS ENUM ('WHATSAPP', 'EMAIL', 'TEAMS', 'SLACK');
CREATE TYPE external_delivery_status AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- ============================================================================
-- Shared audit columns pattern
-- Every operational table includes company_id plus created/updated/deleted data.
-- ============================================================================

-- ============================================================================
-- Tenancy, organization, identity, and access control
-- ============================================================================

CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name VARCHAR(180) NOT NULL,
  trade_name VARCHAR(180),
  nit VARCHAR(30) NOT NULL UNIQUE,
  verification_digit VARCHAR(2),
  economic_activity_code VARCHAR(20),
  arl_name VARCHAR(120),
  arl_risk_class SMALLINT CHECK (arl_risk_class BETWEEN 1 AND 5),
  address VARCHAR(240),
  phone VARCHAR(40),
  email CITEXT,
  report_export_expiration_days INTEGER CHECK (report_export_expiration_days BETWEEN 1 AND 365),
  report_export_retention_days INTEGER CHECK (report_export_retention_days BETWEEN 0 AND 365),
  report_failure_rate_alert_percent INTEGER CHECK (report_failure_rate_alert_percent BETWEEN 1 AND 100),
  report_storage_alert_bytes INTEGER CHECK (report_storage_alert_bytes >= 0),
  whatsapp_alerts_enabled BOOLEAN NOT NULL DEFAULT false,
  whatsapp_alert_phone VARCHAR(20),
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  name VARCHAR(160) NOT NULL,
  code VARCHAR(50),
  address VARCHAR(240),
  city VARCHAR(100),
  department VARCHAR(100),
  is_main BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (company_id, code)
);

CREATE TABLE external_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  provider external_delivery_provider NOT NULL,
  status external_delivery_status NOT NULL DEFAULT 'PENDING',
  target VARCHAR(180),
  subject VARCHAR(240),
  payload JSONB,
  response JSONB,
  error TEXT,
  entity VARCHAR(120),
  entity_id VARCHAR(120),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  next_attempt_at TIMESTAMPTZ,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_external_deliveries_provider_status
  ON external_deliveries(provider, status, attempted_at);
CREATE INDEX idx_external_deliveries_retry
  ON external_deliveries(status, next_attempt_at);
CREATE INDEX idx_external_deliveries_company
  ON external_deliveries(company_id, attempted_at);

CREATE TABLE work_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  name VARCHAR(160) NOT NULL,
  code VARCHAR(50),
  arl_risk_class SMALLINT CHECK (arl_risk_class BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (company_id, code)
);

CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  name VARCHAR(160) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (company_id, site_id, name)
);

CREATE TABLE processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  name VARCHAR(160) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (company_id, name)
);

CREATE TABLE job_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  process_id UUID REFERENCES processes(id) ON DELETE SET NULL,
  name VARCHAR(160) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (company_id, name)
);

CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(100) NOT NULL UNIQUE,
  module VARCHAR(80) NOT NULL,
  description TEXT
);

CREATE TABLE role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE RESTRICT,
  full_name VARCHAR(180) NOT NULL,
  email CITEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  status user_status NOT NULL DEFAULT 'ACTIVE',
  last_login_at TIMESTAMPTZ,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  company_id UUID REFERENCES companies(id) ON DELETE RESTRICT,
  site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE RESTRICT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL,
  entity_name VARCHAR(100) NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Employees
-- ============================================================================

CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  work_center_id UUID REFERENCES work_centers(id) ON DELETE SET NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  job_position_id UUID REFERENCES job_positions(id) ON DELETE SET NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  document_type VARCHAR(20) NOT NULL DEFAULT 'CC',
  document_number VARCHAR(40) NOT NULL,
  email CITEXT,
  phone VARCHAR(40),
  birth_date DATE,
  hire_date DATE,
  termination_date DATE,
  employment_type VARCHAR(60),
  status employment_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (company_id, document_type, document_number)
);

CREATE TABLE employee_job_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  previous_job_position_id UUID REFERENCES job_positions(id) ON DELETE SET NULL,
  new_job_position_id UUID REFERENCES job_positions(id) ON DELETE SET NULL,
  changed_at DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Legal compliance and SG-SST evaluations
-- ============================================================================

CREATE TABLE legal_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(80) NOT NULL,
  title VARCHAR(240) NOT NULL,
  issuing_authority VARCHAR(160),
  publication_date DATE,
  category VARCHAR(100),
  summary TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (code, title)
);

CREATE TABLE company_legal_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  legal_requirement_id UUID NOT NULL REFERENCES legal_requirements(id) ON DELETE RESTRICT,
  applies BOOLEAN NOT NULL DEFAULT true,
  compliance_status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
  responsible_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  last_reviewed_at DATE,
  next_review_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, legal_requirement_id)
);

CREATE TABLE sgsst_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  name VARCHAR(180) NOT NULL,
  evaluation_type VARCHAR(80) NOT NULL, -- initial, minimum_standards, legal, custom
  period_year INTEGER NOT NULL,
  status evaluation_status NOT NULL DEFAULT 'DRAFT',
  total_score NUMERIC(6,2),
  evaluated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE evaluation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES sgsst_evaluations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  code VARCHAR(80),
  requirement TEXT NOT NULL,
  max_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  obtained_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  compliance_status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
  observations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Annual work plan and action plans
-- ============================================================================

CREATE TABLE annual_work_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  period_year INTEGER NOT NULL,
  name VARCHAR(180) NOT NULL,
  objective TEXT,
  status workflow_status NOT NULL DEFAULT 'DRAFT',
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (company_id, period_year)
);

CREATE TABLE annual_work_plan_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  annual_work_plan_id UUID NOT NULL REFERENCES annual_work_plans(id) ON DELETE CASCADE,
  name VARCHAR(220) NOT NULL,
  description TEXT,
  module_source VARCHAR(80),
  responsible_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  start_date DATE,
  due_date DATE,
  completed_at DATE,
  budget NUMERIC(14,2),
  progress_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  status action_status NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE action_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  source_type VARCHAR(80) NOT NULL,
  source_id UUID,
  title VARCHAR(220) NOT NULL,
  description TEXT,
  responsible_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  due_date DATE,
  closed_at DATE,
  status action_status NOT NULL DEFAULT 'OPEN',
  effectiveness_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE action_plan_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  action_plan_id UUID NOT NULL REFERENCES action_plans(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  comment TEXT NOT NULL,
  status action_status,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Risk management: hazard matrix
-- ============================================================================

CREATE TABLE hazard_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(60) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  description TEXT
);

CREATE TABLE hazards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hazard_category_id UUID NOT NULL REFERENCES hazard_categories(id) ON DELETE RESTRICT,
  name VARCHAR(180) NOT NULL,
  description TEXT,
  UNIQUE (hazard_category_id, name)
);

CREATE TABLE hazard_matrices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  name VARCHAR(180) NOT NULL,
  methodology VARCHAR(80) NOT NULL DEFAULT 'GTC_45',
  version INTEGER NOT NULL DEFAULT 1,
  status document_status NOT NULL DEFAULT 'DRAFT',
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (company_id, site_id, name, version)
);

CREATE TABLE risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  hazard_matrix_id UUID NOT NULL REFERENCES hazard_matrices(id) ON DELETE CASCADE,
  process_id UUID REFERENCES processes(id) ON DELETE SET NULL,
  area_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  job_position_id UUID REFERENCES job_positions(id) ON DELETE SET NULL,
  hazard_id UUID NOT NULL REFERENCES hazards(id) ON DELETE RESTRICT,
  activity VARCHAR(220) NOT NULL,
  task VARCHAR(220),
  possible_effects TEXT,
  exposed_people INTEGER,
  probability_score NUMERIC(8,2),
  consequence_score NUMERIC(8,2),
  exposure_score NUMERIC(8,2),
  risk_score NUMERIC(10,2),
  inherent_risk_level risk_level NOT NULL,
  residual_risk_level risk_level,
  acceptability VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE risk_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  risk_assessment_id UUID NOT NULL REFERENCES risk_assessments(id) ON DELETE CASCADE,
  control_type VARCHAR(80) NOT NULL, -- elimination, substitution, engineering, administrative, ppe
  description TEXT NOT NULL,
  is_existing BOOLEAN NOT NULL DEFAULT true,
  responsible_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  due_date DATE,
  status action_status NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Document management
-- ============================================================================

CREATE TABLE document_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE RESTRICT,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  UNIQUE (company_id, name)
);

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  category_id UUID REFERENCES document_categories(id) ON DELETE SET NULL,
  code VARCHAR(80),
  title VARCHAR(220) NOT NULL,
  description TEXT,
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status document_status NOT NULL DEFAULT 'DRAFT',
  current_version INTEGER NOT NULL DEFAULT 1,
  effective_date DATE,
  expiration_date DATE,
  retention_years INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (company_id, code)
);

CREATE TABLE document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  file_url TEXT NOT NULL,
  file_hash VARCHAR(128),
  change_summary TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, version)
);

CREATE TABLE document_acknowledgements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  document_version_id UUID NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET,
  UNIQUE (document_version_id, employee_id)
);

-- ============================================================================
-- Training
-- ============================================================================

CREATE TABLE training_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE RESTRICT,
  name VARCHAR(180) NOT NULL,
  description TEXT,
  is_mandatory BOOLEAN NOT NULL DEFAULT false,
  validity_months INTEGER,
  UNIQUE (company_id, name)
);

CREATE TABLE training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  topic_id UUID REFERENCES training_topics(id) ON DELETE SET NULL,
  title VARCHAR(220) NOT NULL,
  description TEXT,
  instructor_name VARCHAR(180),
  location VARCHAR(180),
  scheduled_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  status training_status NOT NULL DEFAULT 'PLANNED',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE training_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  training_session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  status attendance_status NOT NULL DEFAULT 'INVITED',
  score NUMERIC(5,2),
  certificate_url TEXT,
  attended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (training_session_id, employee_id)
);

CREATE TABLE employee_competencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  training_topic_id UUID NOT NULL REFERENCES training_topics(id) ON DELETE RESTRICT,
  acquired_at DATE,
  expires_at DATE,
  source_attendance_id UUID REFERENCES training_attendance(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, training_topic_id)
);

-- ============================================================================
-- Inspections
-- ============================================================================

CREATE TABLE inspection_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  name VARCHAR(180) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);

CREATE TABLE inspection_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES inspection_checklists(id) ON DELETE CASCADE,
  item_order INTEGER NOT NULL,
  question TEXT NOT NULL,
  expected_answer VARCHAR(40),
  is_critical BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (checklist_id, item_order)
);

CREATE TABLE inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  checklist_id UUID REFERENCES inspection_checklists(id) ON DELETE SET NULL,
  site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  area_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  title VARCHAR(220) NOT NULL,
  inspected_at TIMESTAMPTZ,
  inspector_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status workflow_status NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE inspection_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  checklist_item_id UUID REFERENCES inspection_checklist_items(id) ON DELETE SET NULL,
  answer VARCHAR(40) NOT NULL,
  observation TEXT,
  is_nonconforming BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Incidents, accidents, investigations
-- ============================================================================

CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  area_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  reported_by UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type incident_type NOT NULL,
  status incident_status NOT NULL DEFAULT 'REPORTED',
  title VARCHAR(220) NOT NULL,
  description TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  location_detail TEXT,
  immediate_actions TEXT,
  is_serious BOOLEAN NOT NULL DEFAULT false,
  arl_report_number VARCHAR(80),
  disability_days INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE incident_witnesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  full_name VARCHAR(180),
  contact VARCHAR(120),
  statement TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE incident_investigations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  incident_id UUID NOT NULL UNIQUE REFERENCES incidents(id) ON DELETE CASCADE,
  investigation_started_at DATE,
  investigation_closed_at DATE,
  immediate_causes TEXT,
  basic_causes TEXT,
  root_cause TEXT,
  methodology VARCHAR(80),
  conclusions TEXT,
  investigator_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE incident_investigation_team (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id UUID NOT NULL REFERENCES incident_investigations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  role VARCHAR(100) NOT NULL,
  CHECK (user_id IS NOT NULL OR employee_id IS NOT NULL)
);

-- ============================================================================
-- Audits
-- ============================================================================

CREATE TABLE audit_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  period_year INTEGER NOT NULL,
  name VARCHAR(180) NOT NULL,
  objective TEXT,
  status workflow_status NOT NULL DEFAULT 'DRAFT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, period_year, name)
);

CREATE TABLE audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  audit_program_id UUID REFERENCES audit_programs(id) ON DELETE SET NULL,
  title VARCHAR(220) NOT NULL,
  scope TEXT,
  criteria TEXT,
  auditor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  planned_start_date DATE,
  planned_end_date DATE,
  executed_start_at TIMESTAMPTZ,
  executed_end_at TIMESTAMPTZ,
  status audit_status NOT NULL DEFAULT 'PLANNED',
  report_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  item_order INTEGER NOT NULL,
  criterion TEXT NOT NULL,
  evidence_required TEXT,
  result VARCHAR(60),
  observation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (audit_id, item_order)
);

CREATE TABLE audit_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  checklist_item_id UUID REFERENCES audit_checklist_items(id) ON DELETE SET NULL,
  finding_type finding_type NOT NULL,
  title VARCHAR(220) NOT NULL,
  description TEXT,
  requirement_reference TEXT,
  responsible_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  due_date DATE,
  closed_at DATE,
  status action_status NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Indicators and KPIs
-- ============================================================================

CREATE TABLE indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  code VARCHAR(80) NOT NULL,
  name VARCHAR(180) NOT NULL,
  category VARCHAR(80) NOT NULL, -- structure, process, result
  formula TEXT,
  unit VARCHAR(40),
  periodicity VARCHAR(40) NOT NULL DEFAULT 'MONTHLY',
  target_value NUMERIC(14,4),
  responsible_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

CREATE TABLE indicator_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  indicator_id UUID NOT NULL REFERENCES indicators(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  numerator NUMERIC(14,4),
  denominator NUMERIC(14,4),
  value NUMERIC(14,4) NOT NULL,
  target_value NUMERIC(14,4),
  measured_by UUID REFERENCES users(id) ON DELETE SET NULL,
  observations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (indicator_id, period_start, period_end)
);

-- ============================================================================
-- Evidence files: normalized attachment registry
-- ============================================================================

CREATE TABLE evidence_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  owner_type evidence_owner_type NOT NULL,
  owner_id UUID NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  mime_type VARCHAR(120),
  file_size_bytes BIGINT,
  file_hash VARCHAR(128),
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Recommended seed data for core roles
-- ============================================================================

INSERT INTO roles (code, name, description, is_system)
VALUES
  ('ADMIN', 'Administrador', 'Administra plataforma, empresas, usuarios y configuracion.', true),
  ('SST', 'Responsable SST', 'Gestiona los procesos operativos del SG-SST.', true),
  ('EMPLOYEE', 'Empleado', 'Reporta eventos, consulta documentos y participa en actividades.', true),
  ('AUDITOR', 'Auditor', 'Consulta, verifica y registra hallazgos de auditoria.', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO hazard_categories (code, name, description)
VALUES
  ('PHYSICAL', 'Fisico', 'Ruido, vibracion, temperatura, radiaciones e iluminacion.'),
  ('CHEMICAL', 'Quimico', 'Gases, vapores, polvos, humos, liquidos y sustancias peligrosas.'),
  ('BIOLOGICAL', 'Biologico', 'Virus, bacterias, hongos, fluidos y vectores.'),
  ('BIOMECHANICAL', 'Biomecanico', 'Posturas, movimientos repetitivos y manipulacion de cargas.'),
  ('PSYCHOSOCIAL', 'Psicosocial', 'Factores intralaborales, extralaborales y estres.'),
  ('SAFETY_CONDITIONS', 'Condiciones de seguridad', 'Mecanico, electrico, locativo, tecnologico, transito y publico.'),
  ('NATURAL_PHENOMENA', 'Fenomenos naturales', 'Sismo, inundacion, vendaval y otros eventos naturales.')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- Indexes: tenancy, foreign keys, reporting, and workflow queries
-- ============================================================================

CREATE INDEX idx_sites_company ON sites(company_id);
CREATE INDEX idx_work_centers_company ON work_centers(company_id);
CREATE INDEX idx_departments_company_site ON departments(company_id, site_id);
CREATE INDEX idx_processes_company ON processes(company_id);
CREATE INDEX idx_job_positions_company_process ON job_positions(company_id, process_id);

CREATE INDEX idx_users_company_status ON users(company_id, status);
CREATE INDEX idx_users_email_active ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_roles_company ON user_roles(company_id, role_id);
CREATE UNIQUE INDEX uq_user_roles_global ON user_roles(user_id, role_id) WHERE company_id IS NULL;
CREATE UNIQUE INDEX uq_user_roles_company ON user_roles(user_id, role_id, company_id) WHERE company_id IS NOT NULL;
CREATE INDEX idx_audit_logs_company_created ON audit_logs(company_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_name, entity_id);

CREATE INDEX idx_employees_company_status ON employees(company_id, status);
CREATE INDEX idx_employees_company_site ON employees(company_id, site_id);
CREATE INDEX idx_employees_job_position ON employees(company_id, job_position_id);
CREATE INDEX idx_employee_history_employee ON employee_job_history(employee_id, changed_at DESC);

CREATE INDEX idx_company_legal_status ON company_legal_requirements(company_id, compliance_status);
CREATE INDEX idx_company_legal_next_review ON company_legal_requirements(company_id, next_review_at);
CREATE INDEX idx_sgsst_evaluations_company_period ON sgsst_evaluations(company_id, period_year, evaluation_type);
CREATE INDEX idx_evaluation_items_evaluation ON evaluation_items(evaluation_id);

CREATE INDEX idx_annual_plans_company_year ON annual_work_plans(company_id, period_year);
CREATE INDEX idx_plan_activities_company_status_due ON annual_work_plan_activities(company_id, status, due_date);
CREATE INDEX idx_action_plans_company_status_due ON action_plans(company_id, status, due_date);
CREATE INDEX idx_action_plans_source ON action_plans(source_type, source_id);

CREATE INDEX idx_hazard_matrices_company_status ON hazard_matrices(company_id, status);
CREATE INDEX idx_risk_assessments_company_level ON risk_assessments(company_id, inherent_risk_level);
CREATE INDEX idx_risk_assessments_matrix ON risk_assessments(hazard_matrix_id);
CREATE INDEX idx_risk_assessments_process_area ON risk_assessments(company_id, process_id, area_id);
CREATE INDEX idx_risk_controls_assessment_status ON risk_controls(risk_assessment_id, status);

CREATE INDEX idx_documents_company_status ON documents(company_id, status);
CREATE INDEX idx_documents_company_expiration ON documents(company_id, expiration_date);
CREATE INDEX idx_document_versions_document ON document_versions(document_id, version DESC);
CREATE INDEX idx_document_ack_employee ON document_acknowledgements(employee_id, acknowledged_at DESC);

CREATE INDEX idx_training_sessions_company_status_date ON training_sessions(company_id, status, scheduled_at);
CREATE INDEX idx_training_attendance_employee ON training_attendance(employee_id, status);
CREATE INDEX idx_employee_competencies_expiry ON employee_competencies(company_id, expires_at);

CREATE INDEX idx_inspections_company_status_date ON inspections(company_id, status, inspected_at DESC);
CREATE INDEX idx_inspection_answers_inspection ON inspection_answers(inspection_id);

CREATE INDEX idx_incidents_company_status_date ON incidents(company_id, status, occurred_at DESC);
CREATE INDEX idx_incidents_company_type ON incidents(company_id, event_type);
CREATE INDEX idx_incidents_employee ON incidents(employee_id, occurred_at DESC);
CREATE INDEX idx_incident_investigation_incident ON incident_investigations(incident_id);
CREATE INDEX idx_incident_team_investigation ON incident_investigation_team(investigation_id);

CREATE INDEX idx_audits_company_status_dates ON audits(company_id, status, planned_start_date, planned_end_date);
CREATE INDEX idx_audit_findings_company_status_due ON audit_findings(company_id, status, due_date);
CREATE INDEX idx_audit_findings_audit ON audit_findings(audit_id);

CREATE INDEX idx_indicators_company_active ON indicators(company_id, is_active);
CREATE INDEX idx_indicator_measurements_period ON indicator_measurements(company_id, period_start, period_end);
CREATE INDEX idx_indicator_measurements_indicator ON indicator_measurements(indicator_id, period_start DESC);

CREATE INDEX idx_evidence_owner ON evidence_files(owner_type, owner_id);
CREATE INDEX idx_evidence_company_uploaded ON evidence_files(company_id, uploaded_at DESC);

-- JSONB GIN indexes for audit diff searches.
CREATE INDEX idx_audit_logs_old_values_gin ON audit_logs USING gin (old_values);
CREATE INDEX idx_audit_logs_new_values_gin ON audit_logs USING gin (new_values);
