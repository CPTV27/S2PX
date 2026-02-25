---
sidebar_position: 8
title: "Section 8: Standards & Technical Framework"
---


## 📐 Section 8: Standards & Technical Framework
The 12-Point Assurance Standard
Every deliverable explicitly addresses the common accountability failures in scan-to-BIM. Creates a defensible benchmark competitors cannot claim to meet without changing their operations.
#
Point
What It Requires
1
Deliverables Listed
Specific formats, disciplines, file types explicitly enumerated
2
LoD Stated per Discipline
Architecture LoD X, Structure LoD X, Mechanical LoD X — stated in proposal
3
LoA Stated for Point Cloud
LoA-40 per USIBD v3.1 (≤3mm studio RMS, ≥65% overlap) or stated alternative
4
LoA Stated for Model
LoA-30 per USIBD v3.1 (≤12mm positional accuracy typical) or stated alternative
5
Coordinate Basis Stated
Project-local with origin description, or CRS with EPSG code if georeferenced
6
Level Datum Stated
What elevation = 0'-0". Project assumed or tied to NAVD88/other datum
7
Control Documented
Survey control points with coordinates and accuracy, or "no control used" stated
8
Registration Metrics
RMS residuals, overlap percentages, scan count — from actual registration software
9
Coverage Limits Stated
What areas were scanned, excluded, inaccessible — with coverage map
10
Assumptions Logged
Interpretations made where data was unclear, obstructed, or required estimation
11
Acceptance Defined
What constitutes "pass" — measurable criteria, not subjective satisfaction
12
Support Scope Defined
What's included (corrections, assistance), what requires change order, for how long
Operational Checklists Supporting Assurance Standard
Checklist
Version
S2P Field Capture Checklist
v1.2
S2P Point Cloud Registration & Processing Checklist
v1.2
S2P BIM/CAD QC Checklist
v1.2
S2P Point Cloud Delivery Readiness Checklist
v1.4
S2P Delivery Readiness Checklist
v1.2
Point Cloud QA/QC Acceptance Checklist
v3 (P14)
Certificate of Assurance Template
v1.3
All checklists feed the 12-Point Assurance Standard verification chain. Checklists are standalone documents (Rule #8). See Section 13 for lifecycle data map and Appendix B for field-level traceability.
Privacy / Security Tiers
Tier
Description
Tier-1 (Default)
Standard cloud delivery; passworded links; redundant backups
Tier-2 (Enhanced)
Enhanced privacy; view-only where possible; time-boxed retention; blur faces/plates in imagery
Tier-3 (Restricted)
Limited/no cloud; on-prem/air-gapped or physical media; optional chain-of-custody log; optional certificate of destruction after retention period
Security tier selection drives delivery method for every project.
Level of Accuracy (LoA) Standards
Based on USIBD LOA Specification Guide 2025.
LoA Bands (USIBD-Aligned):
Level
Upper Range
Lower Range
LoA 10
User Defined
5cm
LoA 20
5cm
15mm
LoA 30
15mm
5mm
LoA 40
5mm
1mm
LoA 50
1mm
0
S2P Precision Standards:
- Point cloud typical precision: ≤ 1/8" (LoA-40)
- Model typical precision: ≤ 1/2" (LoA-30)
LoA Declaration:
S2P declares LoA on every project alongside LoD. Most competitors declare LoD only (what gets modeled) but not LoA (how accurately it's placed relative to reality). Dual-standard declaration central to "Certainty Lies in Good Data" messaging pillar.
Validation Methods:
- A-Validation: Instrument/control checks recorded (X7/VLX2)
- B-Validation: Standard validation using Trimble X7 self-leveling and Registration Assist; software registration reports stored with project
- C-Validation: Enhanced validation for Tier-A projects using NavVis + Trimble X7 control data; control points and CRS tie documented
QA Hard Acceptance Gates (Numeric Rules)
Fail any = reject or documented exception with Studio Manager and/or client sign-off
Point Cloud Registration Standards:
- Field RMS residual ≤ 5mm
- 95% of scan-to-scan residuals ≤ 8mm
- Average overlap ≥ 65% (target ≥ 70%; <33% = FAIL)
- Studio RMS residual ≤ 3mm
Point Density Floors (After Decimation):
- Standard / LoA-30 / LoD 200-300: Mean spacing ≤ 15mm (≈ ≥4,500 pts/m²); 5th percentile ≥ 2,500 pts/m²
- High-precision / LoA-40 / LoD 300-350: Mean spacing ≤ 10mm (≈ ≥10,000 pts/m²); 5th percentile ≥ 4,500 pts/m²
- Special high-detail / LoA-50: Mean spacing ≤ 5mm (≈ ≥40,000 pts/m²)
File Size Operational Ceilings (32 GB RAM baseline):
- Revit/Navis (RCP/RCS): per bundle ≤ 2GB or ≤ 50M pts; whole building linked ≤ 20GB
- Archicad (E57/XYZ tile): ≤ 5GB or ~≤ 25M pts
- Vectorworks (LAZ/LAS/E57 tile): ≤ 3-4GB
- Rhino (modeling tile): ≤ 100M pts; above = "viewer/reference only"
- SketchUp (Scan Essentials/Undet tile): ≤ 1-2M pts (room/zone scale)
Global Kill Switch:
Acceptance void if any hold without documented exception: scan incomplete vs agreed scope, LoA fail, LoD fail vs contracted LoD, QC process fail (BIM/CAD QC Checklist v1.2 4-pass sign-off incomplete, or P14 sections 2-7 incomplete).
10% Sqft Variance Hard Gate:
If actual sqft deviates >10% from estimate, triggers review.
Level of Development (LoD) Standards
S2P delivers at three primary standards plus 350+ tier for specialized work.
LoD 200 "Approximate Geometry"
Schematic-level documentation. Default Revit families, generic profiles. Use case: early feasibility, space planning, massing studies.
- Walls/floors/roofs/ceilings: basic geometry
- Doors/windows: default Revit families
- Stairs: default/uniform type
- Structural: major/main components only (beam, column, truss)
- MEP: large duct only (generic, no duct system), conduit >3" only, pipe >2" only, fire pipe >2" only
- Landscape: basic topography with approximate dimensions
LoD 300 "Accurate Geometry"
Construction-document-level documentation. Use case: design development, permit sets, coordination.
- Doors/windows: default frames/handles/muntins, vision panels/louvers included
- Specific railings with balusters at specific locations
- Storefronts/curtain walls: default Revit mullions
- Structural: default components including columns/beams/trusses (braces NOT included)
- MEP: generic duct WITH specified duct system and generic accessories, conduit >1.5", pipe >1.5", flex duct (major, >8", no branches), default air terminals/grills, default lights/receptacles/switches
- Plumbing: fixtures as default Revit families (no taps/shower)
- Casework: fixed components as approximate generic blocks
- Landscape: basic topography with patterns/ground features, default trees/fences
LoD 350 "Precise Geometry"
Construction-ready documentation with specialized detail. Use case: clash detection, fabrication-level planning, historic preservation, construction documents.
- Custom frames/handles/muntins/door types
- Custom mullion profiles on storefronts/curtain walls
- Skirting/sweep/moulding/stack walls/in-situ depressions/extrusions on surfaces
- Custom stair/stringer profiles with material-specific types
- Custom baluster and rail profiles
- Parametric plumbing fixtures with taps/showers
- Custom casework with profiles; custom kitchen casework with taps
- Custom chimney detailing
- Structural: framing components including braces
- MEP: specified duct systems with detailed accessories (coils, connectors), all conduit >1", all pipe sizes, flex duct including branches, custom equipment families, custom cable tray with inclination, all electrical components with custom families
- Component details/specifications editable via parameters
- Landscape: detailed topography with land development features/finishes/rooftop equipment, custom trees/light poles/bollards/road signs/parking components
LoD 350+ "Specialized Detail"
Extends 350. Use case: structural analysis, fabrication, historic documentation requiring element-level precision.
- Structural connections (gusset plates, bolts, nuts)
- Custom roof gutter profiles/fascia/soffits
- Parametric skylight/rooftop families
- Full roof structure with rafter/purlins/joists/webs/gusset plates/connections
- Pipe/duct hangers with custom families
- Full parameter editing across all components

### 8.A — BIM QC Workflow — 4-Pass Process
Pass
Operator
Role
Focus
1
Modeler
Self-QC
Create model per LoD spec + completeness self-check: element placement, family accuracy, discipline coverage
2
Peer Reviewer
Fresh-Eyes QC
Independent review: point cloud overlay verification, accuracy spot-checks, LoD compliance. Reviewer is NEVER the same person who created the model.
3
QC Operator 1 — Drayton (QC Lead)
Technical QC
Model structure review: coordinate setup, worksets, file organization, template compliance. Point cloud registration cross-check.
4
QC Operator 2 — Megumi (Studio Manager)
Scope + Delivery QC
Scope verification: deliverables match contract, coverage complete, assumptions documented. Platform load test: client software compatibility, point cloud links, no errors.
Dual sign-off required: Both Drayton and Megumi must sign off on BIM/CAD QC Checklist v1.2 before delivery proceeds.
Design principles: Pass 2 reviewer is NEVER the modeler (prevents confirmation bias). Passes 3 and 4 are performed by named operators — not interchangeable roles. All 4 passes documented in checklist sign-off block. Platform load test integrated into Pass 4.
QC Checklist Modules:
Module
Verification Items
Module 1: Revit Setup
Project coordinates, templates, worksets, georeferencing, shared coordinates
Module 2: Revit Modeling
Element placement per LoD, center-of-density application, family accuracy, discipline coverage
Module 3: Revit Maintenance
Warnings <300, purge unused, audit file, family optimization
Module 4: Scanning QC
Field capture verification, vertical control, known dimension checks, coverage completeness
Module 5: Registration QC
RMS validation, coordinate setup, file organization, archive verification

### 8.B — Measured vs Represented Accuracy
- Measured Accuracy: Standard deviation range achieved from raw point cloud measurements.
- Represented Accuracy: Standard deviation range achieved once measured data is processed into BIM model or CAD linework.
The gap exists because BIM software represents walls as idealized planes; real buildings have texture, irregularities, and non-planar surfaces. This translation from objective measurement to parametric representation inherently introduces deviation.
S2P standard in USIBD LOA Schema notation: "40B-30B"
- LoA-40 point cloud with Method B validation (overlap analysis)
- LoA-30 model with Method B validation (independent QC review with point cloud overlay)

### 8.C — Center-of-Density Methodology
When modeling walls and planar surfaces from point cloud data, modelers place the idealized BIM surface at the statistical center of the point distribution.
- Target zone: Modeled surface placed ¼" to ½" from the outer face of point cloud density.
- Rationale: Accounts for surface texture, construction tolerances, and measurement noise.
- Consistency: All modelers apply the same methodology — wall placement decisions are reproducible across team and projects.
- Documented: Methodology disclosed so downstream users understand modeling decisions.
This is systematic interpretation, not error.

### 8.D — Coordinate System Hierarchy
Level
Name
Description
SCS
Scanner Coordinate System
Origin at each scan position. Never delivered to clients.
PCS
Project Coordinate System
Unified system after registration. Typical delivery coordinate system.

## Lgcs
Local Grid Coordinate System
PCS aligned to building grid or client reference. Revit PBP and SP typically reference LGCS.
CRS
Coordinate Reference System
Real-world geographic system (e.g., State Plane NAD83). Requires survey control or GNSS. Identified by EPSG code.
Revit Coordinate Alignment:
- Project Base Point: Internal origin. Set close to building geometry to avoid precision issues far from 0,0,0.
- Survey Point: Links project to external reference (building grid, site benchmark, or CRS if georeferenced).
- Shared Coordinates: Enables multiple models to align automatically when linked. Essential for multi-discipline coordination.

### 8.E — Level of Georeferencing (LoGeoRef)
Level
Definition
LoGeoRef 10
No Georeferencing: Model in arbitrary PCS or LGCS. No real-world coordinate connection. Appropriate for interior-only projects with no site/civil needs.
LoGeoRef 20
Approximate: Model roughly positioned via address lookup or satellite imagery. S2P does not deliver LoGeoRef 20 — creates false confidence.
LoGeoRef 30
Survey-Controlled (By Request): Coordinates tied to named CRS through documented survey control. Transformation validated through control point residuals.
S2P policy: If a project is aligned visually to imagery but not anchored to survey control, S2P describes it as "project/local coordinates only," NOT "georeferenced."

### 8.F — MEP Sizing Thresholds (Default LoD 300)
System
Minimum Size
Rationale
Ductwork
≥6" diameter
Main distribution; smaller branches rarely affect coordination
Piping (Domestic)
≥1.5" diameter
Mains and risers; branch lines excluded
Conduit
All visible
Coordination value regardless of size
Fire Protection
All visible
Life safety — documented completely
Cable Tray
All visible
Major routing infrastructure
Adjustable per project. Healthcare/lab facilities often require lower thresholds. General office may accept higher.

### 8.G — QA Packet Standard Contents
Component
Contents
Certificate of Assurance
12-Point Assurance Standard verification
Assumption Register
All assumed geometries: location, elements, basis
Deliverable Index
Each filename with description, platform, coordinate status, format, version
Non-Conformance Log (NCR)
Each non-conformance: type, disposition, resolution
NCR Categories:
- Coverage Gap: Area could not be scanned (locked room, hazardous, equipment blocking). Resolution: document, note in model, or schedule rescan.
- Registration Anomaly: Specific scans exceed RMS threshold. Resolution: investigate, re-register, remove problematic scans, document impact.
- Model Discrepancy: QC identifies element not matching point cloud. Resolution: correct, re-verify, document root cause.

### 8.H — Pre-Scan Checklist
Standalone printable for facility managers and project coordinators. Covers:
- Before Scheduling (address, sqft, type, disciplines, use case, existing docs)
- Access & Logistics (all areas, keys, ceiling access, MEP rooms, roof, parking, site contact)
- Site Conditions (obstructions, active construction, occupancy, sensitive areas, hazards)
- Technical Requirements (coordinates, survey control, client template, file formats, security tier)
- Timeline & Communication (standard/expedited, decision-maker, primary contact, kickoff call)

### 8.I — Revit Workset Naming Standards
Workset
Contents
00_Grids and Levels
Project grids, levels, reference planes
01_Core and Shell (ALT: 01_Exterior)
Exterior walls, roof, foundation
02_Interior
Interior walls, ceilings, floors, finishes
03_Structure
Structural elements (beams, columns, etc.)
05_Stair and Railings
All stairs, railings, ramps
06_Doors
All door families
07_Windows and Curtainwalls
Windows, storefronts, curtain walls
08_Furniture
Furniture, casework, fixtures
09_Links
Linked models, point clouds
41_Mechanical
HVAC ductwork, equipment
42_Electrical
Conduit, cable tray, panels
43_Plumbing
Piping, fixtures, equipment
44_Fire Protection
Sprinkler, risers, FDC

### 8.J — LOD Element Specifications (82 Elements)
01. Exterior Architecture (19 elements):
- Walls: Default profile (200+), details/sweeps/mouldings (350+), in-situ carvings (350+ only)
- Doors: Default Revit (200), default frame/handle/muntin/vision panel/louvers (300), custom frame/handle/muntin (350+), component specs in parameters (350+ only)
- Storefronts: Default mullion (200), custom mullion (300+), custom profile (350+)
- Curtain Walls: Default no mullion (200), default mullion (300), custom mullion (350+)
- Windows: Default Revit (200), default frame/muntin (300), custom (350+)
- Ceilings: Default 0-degree (200+), sweeps/mouldings/inclined (350+)
- Floors: 0-degree (200+), inclined/slab edge (350+)
- Stairs: Default/uniform (200+), stringer/tread profile (350+)
- Railings: Default/approximate baluster location (200+), custom baluster/rail profile (350+)
- Structural Components: Major elements (200+), connections/gusset plates/bolts (350+)
02. Interior Architecture (25 elements):
Same progression as exterior PLUS:
- Plumbing Fixtures: Default Revit family (200+), custom (350+). Taps/shower NOT included at 200.
- Casework: Approximate generic block (200+), custom profiles (350+)
- Kitchen Casework: Default family (200+), custom casework (350+). Taps NOT included at 200.
- Chimney: Opening only (200+), approximate chimney with detailing (350+)
- Furniture: Default Revit family (per client request, 300+)
03. Roof & Roof Structure (8 elements):
- Roof: Default with slopes at drainer locations (200+), sweeps (350+)
- Gutters: Default (200+), custom profile (350+)
- Roof Components: Fascia, soffits (300+)
- Skylights: Default family (300+)
- Roof Structure: Default 0-inclination (200+), intentional slope for rafters (300+)
- Roof Structure Support: Size >3", truss with steel rafter/joist (350+)
04. MEP (16 elements):
Mechanical:
- Duct: Generic without system (200), with duct system (300+), accessories (350+)
- Flex Duct: Major >8" (300+)
- Duct Hangers/Supports: Default/custom (350+)
- Mechanical Equipment/Roof Units: Generic box (200+), parameterized (300+)
- Ceiling/Wall Components: Default air terminal/grill/exhaust (300+)
Electrical:
- Conduit: By nominal diameter — all visible ≥¾" (300), all visible (350+)
- Cable Tray: Default 0-inclination (200+), with inclination (350+)
- Ceiling Components: Default lights/cameras/speakers/sensors (300+)
- Wall Components: Default receptacles/switches/data outlets (300+)
- Electrical Equipment: Panels/transformers/generators (300+)
Plumbing:
- Pipe: By nominal diameter — ≥1.5" (300), all visible (350+). Intentional slope included.
- Pipe Hangers: Default/custom (350+)
- Pipe Components: Default shutoff valves/meters (300+)
- Mechanical Equipment: Water heater/pump/expansion tank/fixtures (300+)
Fire Protection:
- Fire Pipe: By nominal diameter — all visible (300+). Intentional slope included.
- Fire Pipe Hangers: Default/custom (350+)
- Fire Components: Extinguishers/alarms/exit signs/smoke detectors/sprinklers (300+)
05. Landscaping (2 elements):
- Toposurface: Basic topography/approximate dimensions (200), patterns/basic grades (300), detailed with finishes/retaining walls (350+)
- Site Components: Default tree/fence/railing/bollard (300), custom tree/light pole/road sign/parking/patio (350+)

### 8.K — Registration & Processing Hard Gates
Metric
Threshold
Studio RMS
≤3mm (tighter than field ≤5mm)
Cloud LoA
LoA-40 (≤5mm precision)
Archive RCP
Required for every project
Sampling/Decimation Defaults:
- Residential/Commercial Interior: Step 4
- Above Ceiling Tile (ACT): Step 2
- LoD 350 Exterior: Step 1
- Boundary: Residential Interior 25 | Commercial Interior 60 | ACT 150 | Exterior building height + 30' | Landscape 50
LoGeoRef Tiers in Registration:
- Tier 0 (None): Interior-only confirmed, scanner coords acceptable
- Tier 20 (Approximate): Exterior present, Revit positioning completed, transformation values documented
- Tier 60 (Accurate): Survey control used, CRS + EPSG code documented, residuals ≤0.02 ft verified
Handoff Protocol:
- Production PC v1 labeled and delivered to BIM team
- GeoRef tier documented in handoff
- Movement protocol: If PC moved, document transformation values (ΔX, ΔY, ΔZ, rotation) and export Production PC v2
- Studio registration report generated
- Excluded scans documented with reason
