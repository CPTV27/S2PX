---
sidebar_position: 1
title: "Appendix B: Master Data Dictionary v2.1"
---

📊 APPENDIX B: MASTER DATA DICTIONARY v2.1
Preamble
The Master Data Dictionary is the system-architecture and automation reference for Scan2Plan's operational systems. It documents tier systems, project code formats, status values, QA traceability chains, and pricing automation targets.
Purpose: Enable systems development with architecture-level specifications for S2POS automation, Airtable integrations, and pricing logic.
Scope: System architecture (Part I), 12-Point Assurance Standard traceability (Part III), and pricing automation input maps (Part IV).
What is NOT here: Field-level pipeline stage definitions (Stages 0-8) are owned by their respective checklists. The Data Dictionary does not duplicate checklist content. See Section 13 Document Registry for checklist versions and owners.
How to use:
- Part I: System architecture (tier systems, project code format, status values)
- Part III: 12-Point QA Standard traceability chain
- Part IV: Pricing automation input maps (target-state architecture)
Legend:
- [REQ] = Required field (form-enforced or hard gate)
- [GATE] = Hard gate / approval checkpoint (fail = reject or documented exception)
- [SIGN] = Signature / sign-off required


## Part I: System Architecture
1. TIER SYSTEMS (6 systems)
1A. Validation Tiers
Validation Tier
Definition
Equipment
Source
A-Validation
Instrument precision verification
Trimble X7, NavVis VLX2
P14 §4, CoA
B-Validation
Software registration reports
RealWorks, ReCap, IVION, CloudCompare
P14 §4, CoA
C-Validation
Control data / survey points
Total Station, RTK, GNSS, Terrestrial LiDAR
P14 §4, CoA
1B. Project Size Tiers — Minnow / Dolphin / Whale
Codename
SF Range
Revenue Range
Scanning Strategy
Pricing Path
Minnow

## 3-10K Sf
$2,500-$10,000
X7 (in-house, always)
Path 1: $/sqft lookup
Dolphin

## 10-50K Sf
$10,000-$50,000
X7 (in-house, default)
Path 1: $/sqft lookup
Whale

## 50K+ Sf
$50,000+
NavVis SLAM (default) OR X7 (if no schedule pressure + accuracy premium justified)
Path 2: Whale costing
Scanner selection logic for Whales: SLAM (NavVis) is generally used over 50K SF. Evaluate per-project. If no rush, X7 is more cost-effective and more accurate but slower. Decision weighs cost, urgency, and accuracy needs.
1C. All 6 Tier Systems
#
System
Values
Where Used
1
Project Size
Minnow / Dolphin / Whale
PC Delivery Readiness, Final Delivery, Pricing Path
2
Project Size (Final Delivery)
Standard (Minnow+Dolphin) / Whale
Final Delivery Readiness header
3
Scanning Cost (Scoping)
Whale Scan Cost (Whale-only)
Scoping Form
4
Privacy/Security
Tier-1 / Tier-2 / Tier-3
P14 Section 0
5
Georeferencing
LoGeoRef 0 / 20 / 60
Registration 7.1
6
Validation Method

## A / B / C
P14 §4, CoA

## 2. Project Code Format
Source
Format
Example
CoA Template

## S2P-[Seq]-[Year]

## S2P-2077-2026
P14 §8 Naming Convention

## P[Year]-[Seq]

## P2025-014
Incompatible. P14 uses it in filenames. CoA uses it in certificate numbers. Resolution required: one format or two with mapping rule.

## 3. Airtable Status Values
Status
Set By
Checklist
Notes
(new record)
Owen/Matt
Scoping form submission

'Field Complete'
Field Tech
Field Capture 5.1

'Processing Complete'
Megumi
Registration 8.2

'Ready for Delivery'
PM/Megumi
PC Delivery Readiness 5.1 AND Final Delivery Readiness 5.1
Shared status — two checklists set same value
'BIM In Progress'
—
—
Required

## 'Bim Qc'
—
—
Required
'Delivered'
—
—
Required
'Closed/Paid'
—
—
Required
'Lost'
—
—
Required for Win Rate % calculation
Pipeline has 6+ stages but only 4 status values. 5 additional statuses needed.


## Part Iii: 12-Point Qa Standard — Complete Traceability Chain
The 12 Points
#
Point
What It Verifies
1
Deliverables
File list matches contract scope (formats, platforms, coverage)
2
LoD
Model detail matches contracted LoD per discipline
3
Cloud LoA
Point cloud accuracy band verified (LoA-30/40/50)
4
Model LoA
BIM model accuracy verified against tolerance
5
Coordinates
Coordinate system documented (SCS→PCS→LGCS→CRS chain)
6
Datum
Level datum (0'-0") reference documented and verified
7
Control
Control methodology documented (A/B/C Validation)
8
Registration
RMS, residuals, overlap, unified PCS confirmed
9
Coverage
% scanned, % modeled, exclusions justified
10
Assumptions
All assumed elements logged with basis
11
Acceptance
QC process complete, all gates passed, sign-offs collected
12
Support
Lifetime support commitment confirmed
Checklist-to-Point Mapping
Checklist
Points Covered
Sections
Field Capture v1.2
#3, #7, #9, #10
§3 (metrics), §3.2 (coverage), §4 (inaccessible areas)
Registration v1.2
#3, #5, #6, #7, #8
§6.1 (LoA), §7.1 (coords/datum), §7.2 (control), §1.2+§3 (registration)
BIM/CAD QC v1.2
#2, #4, #5, #6, #10
§1.1 (coords/datum), §2 (LoD per element), Module 2 (accuracy)
Final Delivery v1.2
#1, #9, #10, #11
§1 (scope), §1.2 (coverage), §3.1 (QA packet), §3 (acceptance)
P14 QA/QC v3.0
#3, #7, #8
§1.3 (LoA gates), §4 (validation A/B/C), §3-4 (registration)
Registration §6 referenced in footer but does not exist in checklist (numbering jumps 5→7). Footer reference to "§6.1" should be read as Section 7.1.
Point #12 (Support): Mapped to contract/scope documentation per Final Delivery footer. No dedicated checklist step — static text in CoA.
Data Fields Required Per Point (for CoA Auto-Population)
Point
Required Fields
Collection State
1. Deliverables
Deliverable list, formats, platforms
Partial — Deliverable Index manual
2. LoD
Per-discipline LoD
Scoping has single LoD; per-discipline not collected
3. Cloud LoA
Field RMS, Studio RMS, overlap %, LoA band
Collected across checklists, not aggregated to SSOT
4. Model LoA
Model accuracy band, tolerance verification
No discrete field; inferred from QC pass
5. Coordinates
SCS→PCS→LGCS→CRS chain, PBP, SP, CRS/EPSG
Collected across two stages, not unified
6. Datum
Level 0'-0" reference, floor elevations
Checked twice across checklists, no structured SSOT field
7. Control
Validation Tier (A/B/C), control points, residuals
Partial; Validation Tier not in SSOT
8. Registration
Field RMS, Studio RMS, max residual, method, excluded scans
Collected; registration method not in SSOT
9. Coverage
% scanned, % modeled, inaccessible areas
Not collected as structured SSOT fields
10. Assumptions
Count, full rooms, partial elements, basis
Exists as document, no SSOT trigger/rollup
11. Acceptance
All gate passes, all sign-offs, NCR disposition
BIM QC checklist has no sign-off block
12. Support
Lifetime support statement
Static text
CoA auto-population dependency: 7 of 12 points require SSOT fields that do not yet exist as structured data. Points #1, #3, #8 are partially wirable. Points #2, #4, #6, #9 require new fields. Points #10, #11 require workflow triggers. Point #12 is static.

PART IV: PRICING v2 — AUTOMATION INPUT MAP (TARGET STATE)
Pricing Architecture
Path
Used For
Method
Path 1: $/sqft Lookup
Minnow + Dolphin
Building Type x SF Band x Discipline x LoD → $/sqft from matrix
Path 2: Whale Costing
Whale
Bottom-up cost estimation + margin multipliers
Markup tuning: S2P rates derived from production team base rates. Each Building Type x SF Band cell has a different markup tuned by Owen to balance win rate and GM. Adjusted quarterly. Production team rate = cost basis. S2P rate = retail.
Path 1 — Modeling Cost Lookup (Minnow + Dolphin)
Structure: 13 Building Types x 9 SF Bands x 4 Disciplines x 4 LoD Levels = $/sqft rate
Modeling Cost = (Arch $/sqft x Total SF)
             + (Struct $/sqft x Structural SF)    [if Structural = Y]
             + (MEPF $/sqft x MEPF SF)            [if MEPF = Y]
             + (Site $/sqft x Total SF)            [if Grade = Y]
             + (Landscape $/acre x Acres)          [if Landscape = Y]
Path 2 — Whale Costing (Current)
Contract Value = (Whale Scan Cost + Whale Modeling Cost) x Margin Multiplier
- Whale Scan Cost = dropdown ($3,500-$18,500 / Other)
- Whale Modeling Cost = linked external spreadsheet
- Margin Multiplier = 2.352X to 4X
Future Pricing Model — All Tiers (Target State)
1. Estimated Scan Cost
2. Estimated BIM/CAD Cost
3. Estimated Registration Cost
4. Estimated QC Cost
5. Estimated PM Cost
6. Estimated COO/CTO Cost
------------------------------
= Estimated COGS

x Overhead & Profit Markup (30-60%)
= Loaded Cost

x Margin Markup (40-80%)
= PRICE (and implied $/sqft)
Bucket 1: Scan Cost
Key inputs: Total SF, Number of Floors (multi-story multiplier), Building Type (complexity factor), Int/Ext scope, ACT SF, Scanner Type (X7 vs NavVis — different cost structures), Estimated Scan Days, Full vs Half Day (X7: $2,500 vs $1,500), Room Count (scan density proxy), Control Team Required (doubles crew cost for Whale), Building Height (exterior boundary).
Scan Day Heuristic:
Base scans = SF / [scans-per-KSF by building type]
ACT scans = ACT SF / [ACT factor]
Ext scans = [perimeter estimate if Ext = Y]
Total scans = Base + ACT + Ext
Scan days = Total scans / [scans-per-day by scanner]
  X7: ~40-80 scans/day | NavVis: building-based
Calibration requires historical scan-day vs SF data from completed projects.
Bucket 2: BIM/CAD Cost
Key inputs: Total SF, Building Type, LoD per discipline, Structural SF, MEPF SF, ACT SF, CAD Conversion flag, Interior Elevation Count, Custom Template flag. Calibration requires historical modeling hours/KSF by building type x LoD.
Bucket 3: Registration Cost
Key inputs: Scan Count (derivable from heuristic), LoGeoRef Tier, Validation Tier (A/B/C). Calibration requires historical registration hours per scan count.
Bucket 4: QC Cost
Key inputs: Total SF, LoD, Discipline Count. Calibration requires historical QC hours/KSF by LoD.
Bucket 5: PM Cost
Key inputs: Project Tier (Minnow/Dolphin/Whale), Estimated Duration (weeks). Calibration requires historical PM hours per project by tier.
Bucket 6: COO/CTO Cost
Key inputs: Project Tier, Risk Factors. Calibration requires historical executive hours per project.
Travel Cost (Separate Line Item)
Scenario
Mileage
Hotel
Per Diem
Flight
NYC Local
$250 min, then $8/mi one-way
—
—
—
Troy Local
$3/mi one-way
—
—
—
Overnight Local
(same as base)
$150/night
$50/day
—
Overnight + Flying
—
$250/night
$100/day
Manual
Required inputs: One-way Miles, Travel Base Location (NYC vs Troy — different rates), Travel Type (Local / Overnight Local / Overnight+Flying).
Add-Ons / Surcharges
Add-On
Trigger
Rate
Matterport
Matterport = Y
$0.10/sqft
Georeferencing
Georef = Y
Custom
CAD Conversion

## Cad = Y
$/sqft by package
Interior Elevations
Count > 0
$5-$25/elevation by SF band
Expedited
Expedited = Y
20% surcharge
Payment Interest
Net 60/90
10% / 20%
Insurance
Requirements present
Manual
Calibration Dependencies (All Buckets)
All 6 cost buckets require historical time-tracking data to validate estimation formulas. Scan day heuristic (Bucket 1) is the single most impactful gap — feeds scan cost, Scorecard K6, and capacity planning. Collection method: retroactive mining of completed projects + time tracking on active projects.


## 📋 End Matter

DOCUMENT REGISTRY — MKB v4.0
Canonical registry of all S2P operational artifacts. Deduplicated from Section 13.
Operational Checklists
Document
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
Point Cloud QA/QC Acceptance Checklist (P14)
v3
Client-Facing
Document
Version
Certificate of Assurance Template
v1.3
Scan2Plan Client Guide
v3.1
Knowledge Base
Document
Version
S2P Master Knowledge Base
v4.0
Scan2Plan TKB
v2.1
S2P Brand Guide
v3.1
FY2026 Sales & Marketing Strategy Manual
v1.0
Key Spreadsheets
Document
Version
Profitability Report
v5
Weekly Scorecard (EOS)
v3
Pricing Matrix
2025
Product/Service List
v1.6
Competitor Landscape
v7
LOD Standards
2024
SOPs
Document
Version
Proof Vault SOP
v1.0
Corpus Catalog & Twinner Pipeline SOP
v1.0
Systems
System
Status

## S2Pos
60-70% built
QuickBooks Online

## Live
GoHighLevel

## Live
Instantly

## Live
PandaDoc
LIVE (migrating)


Retired
Document
Replaced By
Capabilities Reference v1.0
MKB v4.0 + Client Guide v3.1
Standards Reference v1.0
MKB v4.0 + Client Guide v3.1



S2P Future Pricing Model — MKB Appendix C (Draft v2)
Status: DRAFT — framework only, not active until quarterly pricing review Date: February 17, 2026 Owner: Owen Bush, CEO Data Sources: Scan Heuristic Tracker v1.0, Profitability Report v5, Historic profitability reviews

1. What This Is
This is Scan2Plan's revenue allocation model. It defines where every dollar of revenue goes — both below the line (COGS: what it costs to deliver) and above the line (what funds the business). It is a Profit First model, not a GAAP model. GAAP gross margin (~56%) is a diagnostic output, not the operating framework.
The model has one job: enable confident pricing by nailing the COGS estimate, then applying the highest defensible multiplier.

2. The Full Dollar: Where Every Cent Goes
Revenue Allocation (100%)
Category
Target %
Type
Notes
COGS (below the line)
41%


1. Scanning
8%
Variable
Tech rate × hours. If S2P raises prices, scan cost stays the same in absolute $.
2. Travel
1%
Variable
Mileage + hotel + per diem. Geography-driven, not building-driven. Stays flat if prices rise.
3. Registration
3%
Predictable
~3% consistently. Very stable.
4. BIM/CAD Modeling
18%
Variable
UppTeam fixed pricing. Absolute $ stays same if S2P raises prices — % drops.

## 5. Qc
2%
Fixed %
Revenue-proportional.
6. PM (Kurt)
4%
Fixed %
Revenue-proportional.
7. COO/CTO (Chase)
5%
Fixed %
Revenue-proportional.
Above the line
59%


8. Taxes
15%
Guided
Per accountant recommendation. Dedicated bank account.
9. Owner's Comp
10%
Target
Target 10% for allocation discipline.
10. Sales & Marketing
10%
Budget
New for FY26. Dedicated bank account. Must be planned and tracked.
11. Overhead + Debts
20%
Estimate
Rent, software, insurance, subscriptions, cloud, debt service. Accuracy unknown — could be more or less month to month.
12. Savings
4%
Residual
Dedicated bank account. Strategic goal: increase to 10%.
The Math
Revenue                          = 100%
─────────────────────────────────────────
COGS (Buckets 1-7)              =  41%
Taxes                           =  15%
Owner's Comp                    =  10%
Sales & Marketing               =  10%
Overhead + Debts                =  20%
─────────────────────────────────────────
Savings (what's left)           =   4%
Problem: 4% savings is not enough. Target is 10%.
The only ways to get from 4% to 10%:
- Raise prices (increase revenue per project, COGS stays flat in absolute $, all % buckets compress except fixed-% items)
- Cut overhead (move $ from Overhead bucket to Savings bucket)
- Be disciplined on S&M spend (don't overspend the 10% budget)
- Some combination
Raising prices is the primary lever. Specifically: raising the multiplier.

3. The Pricing Lever: Multiplier on COGS
How Pricing Actually Works at S2P
S2P does not set prices by calculating overhead markups and margin markups separately. The real process:
- Estimate total COGS (Scan + Travel + Reg + Model + QC + PM + COO/CTO)
- Apply a multiplier to get the price
- The multiplier is the only dial Owen turns
The multiplier has a floor (protects margin) and a ceiling (what the market will bear). Owen adjusts it deal by deal based on competitive pressure, relationship value, and strategic importance.
Current vs Target Multiplier
Metric
Current (MKB v3.1)
Target
Multiplier floor
2.352x
2.44x
Multiplier ceiling
~4.0x
~5.0x
Applied to
Production base (Scan + Reg + Model)
Total estimated COGS (all 7 buckets)
GM implied at floor

## ~56% (Gaap)
59%
Savings at floor
~0-2%
4% (minimum)
Savings at 3.0x
—
~10% (target)
The Multiplier Slider (new tool for Pricing Calculator)
COGS estimate (fixed for a given project) × Multiplier = PRICE

Multiplier range: 2.44 ─────|─────|─────|───── 5.0
                  floor    3.0   3.5   4.0   max

At 2.44x: Savings = 4% (floor — walk away below this)
At 3.0x:  Savings ≈ 10% (target)
At 3.5x:  Savings ≈ 15% (strong deal)
At 4.0x+: Savings ≈ 20%+ (premium positioning)
The scanner costs are locked. Owen cannot reduce scan cost — it's tech rate × hours, and the tech rate is the tech rate. Travel is geography. Registration is stable. Modeling is UppTeam's fixed pricing.
The only variable Owen controls is the markup on top of BIM pricing (which is the dominant COGS component at 18%). The entire pricing history of S2P — the evolution across building types, the refinement of category-specific rates — is the record of Owen dialing this markup by trial and error.
The Scan Heuristic Tracker makes the COGS estimate accurate. An accurate COGS estimate means Owen can set the multiplier with confidence instead of guessing.

4. What Makes COGS Predictable vs Variable
Bucket
Predictability
What Changes It
What Doesn't
Scanning (8%)
Medium. Building type and scanner matter.
Building complexity, floors, access conditions, historic vs modern
Price increases (absolute $ stays flat)
Travel (1%)
Low per project. Geographic.
Distance from base, multi-day jobs, overnight
Building type
Registration (3%)
High. Stable around 3%.
Unusual LoA/method requirements
Most projects
Modeling (18%)
High for absolute $. UppTeam has fixed rates.
LoD level, discipline count
Price increases (% drops, $ stays flat)

## Qc (2%)
Fixed. Revenue-proportional.
Revenue
Nothing else

## Pm (4%)
Fixed. Revenue-proportional.
Revenue
Nothing else

## Coo/Cto (5%)
Fixed. Revenue-proportional.
Revenue
Nothing else
Key insight: When S2P raises prices, Buckets 1-4 stay flat in absolute dollars. That means the COGS percentage drops, and the savings percentage increases. This is the entire mechanism for getting from 4% savings to 10%.
Example at $10K project vs $11K project (same work):
                    $10K revenue     $11K revenue (+10%)
Scan                $800 (8%)        $800 (7.3%)
Travel              $100 (1%)        $100 (0.9%)
Reg                 $300 (3%)        $300 (2.7%)
Model               $1,800 (18%)     $1,800 (16.4%)

## Qc                  $200 (2%)        $220 (2%)

## Pm                  $400 (4%)        $440 (4%)

## Coo/Cto             $500 (5%)        $550 (5%)
─────────────────────────────────────────────────

## Cogs                $4,100 (41%)     $4,210 (38.3%)
Taxes               $1,500 (15%)     $1,650 (15%)
Owner               $1,000 (10%)     $1,100 (10%)

## S&M                 $1,000 (10%)     $1,100 (10%)
Overhead            $2,000 (20%)     $2,200 (20%)
─────────────────────────────────────────────────
Savings             $400 (4%)        $740 (6.7%)
At +20% price increase (same work, $12K): Savings = $1,090 = 9.1%. Close to target.

5. The Scan Heuristic Tracker's Role
The Tracker doesn't change pricing directly. It does one thing: makes the COGS estimate accurate.
Without the Tracker, Owen guesses scan cost by building type. With it:
Heuristic
What It Tells You
Pricing Impact
Scans / 1K SF by building type
How many scans a building actually needs
Scan cost estimate accuracy
SF / Scan Hour by building type
How fast the scanner moves through this type
Scan labor cost accuracy
Hours / 1K SF by building type
Direct time-per-size metric
Alternative scan cost check
SF Variance % (est vs actual)
How wrong the scoping SF estimate was
Flags scoping errors before they become pricing errors
Delay Ratio %
How much downtime per scan session
Adds real-world friction to cost estimates
After 10+ projects per building type, these averages replace judgment. Owen can then say: "This 25K SF historic church will take X scans, Y hours, and cost $Z for scanning" — and be right within 10%.
That confidence is what lets him push the multiplier higher on types where he has data.

6. Calibration Signals
Same 12 signals from v1. No change. They trigger pricing review when thresholds are hit. Tracked on:
- Automation Maps v1.1, Tab 9: Pricing_Calibration_Draft (10 signals)
- Scan Heuristic Tracker v1.0, Tab 3: Pricing Review Parking Lot (15 questions)

7. Activation Gates
Same as v1. All components NOT READY or BLOCKED. First quarterly review: April 2026. Full activation: Q4 2026 at earliest.

8. The Path from 4% Savings to 10%
Lever
Mechanism
Realistic Impact
When
Raise prices 10% across board
COGS drops from 41% to ~37%, savings rises to ~8%
+4 pts
After heuristic validation
Selective category repricing
Raise multiplier on categories where S2P has pricing power
+2-3 pts on those categories
Pricing deep dive session
Overhead reduction
Audit subscriptions, cloud, debts
Unknown — need actuals
Budget session
S&M discipline
Don't exceed 10% budget
Prevents savings erosion
Ongoing
Debt paydown
Reduces overhead bucket
Gradual
12-18 months
Most likely path: Selective repricing (+2-3 pts) + overhead discipline (+1-2 pts) = 7-9% savings. Getting to 10% likely requires some combination of all levers.


10. What I'd Like To See in Profitability v5 (Enhancement Request)
Monthly readouts of variable above-the-line costs:
Readout
Source
Purpose
Overhead by category (monthly)
QBO expense reports
Track whether 20% is accurate. Identify reduction targets.
S&M spend by category (monthly)
QBO + bank account
Track against 10% budget. Includes Matt comp.
T&E by category (monthly)
QBO
Travel, meals, entertainment — separate from project travel.
Debt service schedule
QBO + loan docs
Dashboard: balance, payment, payoff date, monthly cost
Actual savings rate (monthly)
Bank account balance delta
Is 4% real? Is it growing?
These don't exist in Profitability v5 today. They would turn the "above the line" from estimates into tracked actuals.

This appendix is DRAFT. Current pricing (MKB Ch 19.4-19.5, Pricing Matrix) remains in effect until activation gates are met. First quarterly review: April 2026.
