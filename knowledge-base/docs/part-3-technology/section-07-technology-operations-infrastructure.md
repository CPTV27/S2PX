---
sidebar_position: 7
title: "Section 7: Technology & Operations Infrastructure"
---


## ⚙️ Section 7: Technology & Operations Infrastructure
Scanning Equipment
- Primary Scanner: Trimble X7 (terrestrial LiDAR, millimeter accuracy, Registration Assist field registration, self-validating data B/C validation). Used on all standard S2P projects. Internal capacity: 40 scan-days/month full months, 30 in Nov, 20 in Dec/Jul/Aug.
- Tier-A Scanner: NavVis VLX 2 via BuildScan 3D vendor (SLAM-based wearable backpack, large-scale rapid capture, C-Validation methodology). Used for Tier-A projects requiring massive coverage. Hybrid approach: X7 control network at 50-75m intervals establishes LoA-40 anchors; VLX2 SLAM traverses constrained to control achieve LoA-30 between anchors.
- Total Station: Available for survey-controlled georeferencing (Tier-3 control networks).
- UAV: Deployed selectively for exteriors, roof conditions, site topography. Part 107 certified pilots on staff. Photogrammetric and LiDAR-equipped options. Deliverables: orthophotos, textured 3D models, topographic surfaces.
Registration Software
- Trimble RealWorks (64-bit, AI-assisted classification, primary registration and decimation platform)
- Autodesk ReCap Pro (RCP/RCS export for Autodesk workflows; used as hybrid with RealWorks)
- CloudCompare (open-source, spot-check density and independent verification)
- Spatial sampling decimation rules per LoA tier
Modeling Software
- Primary: Revit (versions 2022-2025)
- Secondary: AutoCAD, ArchiCAD (25 projects completed, 4-5 active customers — "Native-Flex Specialist" positioning)
- Also Supported: SketchUp, Rhino (NURBS for complex historic geometry), Vectorworks, Solidworks, Chief Architect, Civil 3D
- Clash Detection: Navisworks, Solibri Model Checker (internal QA)
- CAD Drafting: AutoCAD (AIA standards default or client-specific CAD manuals), Civil 3D (site/civil)
Point Cloud Delivery Platforms
- Autodesk Recap (RCP/RCS)
- Trimble ScanExplorer (Windows-only desktop viewer)
- E57 (archive format, universal interchange)
Current State: Trimble Clarity discontinued. Replaced by Trimble Reality Capture Platform Service (TRCPS), launched September 2024 as Trimble Connect extension. TRCPS: cloud-hosted point cloud streaming, browser-based, ~$2,000/year for 1 TB. Requires Trimble ID (no anonymous shareable links). ScanExplorer remains Windows-only with no cloud replacement.
Virtual Tours
- Matterport (acknowledged gap in 360 photo quality vs. best-in-class competitors)
Proposal/E-Signature
- PandaDoc (migrating to S2POS proposal builder)
S2POS (Scan2Plan Operating System)
Full-stack internal operations platform (PostgreSQL + Drizzle, Firebase/GCS, React frontend).
Sales & CPQ Layer: 7-stage pipeline, CPQ calculator with 40% GM gate, proposal builder (WYSIWYG with variable substitution), customer management with QBO sync.
Production & Delivery Layer: 6-stage production tracker, QC validation (4-pass workflow, LoD/LoA compliance, sqft audit, B/C validation), margin tracking, LEED v5 carbon tracking.
Cloud Storage: 3-tier (Firebase, GCS, Synology NAS). Project file structure with auto-archive.
Integrations: QuickBooks Online, Google Drive, Mapbox (travel pricing), PandaDoc.
Strategy Layer: Command Center dashboard, P1-P22 tracker, KPI scorecard.
Operational Architecture
- Lead Gen App → Quote Builder → Airtable Projects → Google Workspace Hub
- Airtable: project tracking, milestones, external team comms
- Google Workspace: P1-P22 tracker, KPI scorecard, task management, Chat Spaces
- Knowledge Base: s2p-help.netlify.app (Docusaurus-hosted, client-facing TKB + internal tool guides)
- File Storage: Google Drive (30TB legacy) migrating to GCS buckets; Synology NAS for production team

### 7.A — Technology Comparison Table
Technology
Looks Good
Self-Validates
AEC-Ready
Best For
Photogrammetry / NeRF
Yes
No
No
Gaming, VR, film
Structured Light (Matterport)
Yes
No
No
Real estate tours
ToF Sensors (iPhone/iPad)
Yes
No
No
Quick conceptual
Mobile LiDAR (Vehicle)
Yes
No
Limited
Roads, infrastructure
SLAM (without control)
Yes
No
Conditional
Large spaces w/control
Terrestrial LiDAR
Yes
Yes
Yes
Construction docs
Vendor qualification questions (give to prospects):
- What scanner do you use?
- Can you provide a registration report showing RMS residuals?
- What LoA specification do you guarantee?
If they can't answer — they're not delivering construction-ready documentation.

### 7.B — Trimble X7 Specifications
Specification
Value
Distance Accuracy (10m)
±2mm
Distance Accuracy (20m)
±3mm
Distance Accuracy (40m)
±5mm
Angular Accuracy
21 arc-seconds
Point Rate
500,000 points/second
Effective Range (Interior)
80m (up to 120m reflective)
Full-Dome Coverage
360° horizontal, 300° vertical
Calibration Interval
Annual factory calibration
Onboard registration with real-time quality feedback. Only scanner that confirms registration quality in the field — eliminating re-mobilization risk. Fewer scans required (58M vs 43M pts/scan); 0.0056 ft (1.7mm) mean point error; 25-30% faster total time vs. competitors due to eliminated post-processing.
Field coverage rate: 500-800 SF per scan position. Typical 50,000 SF building requires 60-100 positions.

### 7.C — Scanning Field Timing References
Scan Type
Time per Scan
HDR
Interior
2:00-2:35
ON
Drop Ceiling
1:35
OFF
Exterior
4:35
ON
Image mode settings: 15 (standard) / 30 (complex environments).
Field registration must be verified before leaving site. Field RMS ≤5mm, average overlap ≥50% (target ≥65%), no scan pair <33% overlap.

### 7.D — Platform-Specific File Size Limits
Revit/Navisworks:
- Tier-C (2-10K SF): Full PC ≤5GB
- Tier-B (10-50K SF): Light PC ≤5GB, Full PC ≤10GB
- Tier-A (50K+ SF): Light PC ≤5GB/bundle, Full PC ≤20GB total
- Exceeds max → Partitioned delivery
Archicad:
- Tier-C: Full PC ≤3GB | Tier-B: Light PC ≤2GB, Full PC ≤3GB | Tier-A: Light PC ≤2GB/bundle, Full PC ≤3GB/bundle
- 4GB hard import limit confirmed
Vectorworks:
- Tier-C: Full PC ≤4GB | Tier-B: Light PC ≤3GB, Full PC ≤5GB | Tier-A: Light PC ≤3GB/bundle, Full PC ≤5GB/bundle
Rhino:
- Tier-C: Full PC ≤3GB | Tier-B: Light PC ≤2GB, Full PC ≤4GB | Tier-A: Light PC ≤2GB/bundle, Full PC ≤4GB/bundle
SketchUp:
- Tier-C: Full PC ≤1.5GB | Tier-B: Light PC ≤1GB, Full PC ≤2GB | Tier-A: Light PC ≤1GB/zone, Full PC ≤2GB/zone
Point Density Limits (by platform): Revit ≤50M pts | Archicad ≤25M pts | SketchUp ≤2M pts | Rhino ≤100M pts
Light PC Creation Process: Full PC → Export to E57 → Re-import to ReCap Pro → Decimate to target density → Export as RCP (Light PC). Swap test required: coordinates must match within 0.0".
