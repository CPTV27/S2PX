import { Router, type Request, type Response } from 'express';
import { db } from '../db.js';
import { scopingForms, scopeAreas } from '../../shared/schema/db.js';
import { eq, sql } from 'drizzle-orm';

const router = Router();

// Map integer priority (1-5) to string for Lead interface
function mapPriority(p: number): string {
    if (p <= 2) return 'high';
    if (p === 3) return 'medium';
    return 'low';
}

// Map scoping form dealStage + status to Lead.status
function mapStatus(dealStage: string, formStatus: string): string {
    if (formStatus === 'won') return 'won';
    if (formStatus === 'lost' || dealStage === 'Lost') return 'lost';
    return dealStage.toLowerCase().replace(/ /g, '_');
}

// Map Lead.status string back to dealStage + formStatus
function reverseMapStatus(status: string): { dealStage: string; formStatus?: string } {
    const map: Record<string, string> = {
        lead: 'Lead', new: 'Lead',
        qualified: 'Qualified',
        proposal: 'Proposal', proposal_sent: 'Proposal',
        negotiation: 'Negotiation',
        in_hand: 'In Hand',
        urgent: 'Urgent',
        lost: 'Lost',
    };
    if (status === 'won') return { dealStage: 'In Hand', formStatus: 'won' };
    if (status === 'lost') return { dealStage: 'Lost', formStatus: 'lost' };
    return { dealStage: map[status] || 'Lead' };
}

function rowToLead(row: any) {
    return {
        id: row.id,
        clientName: row.client_company,
        projectName: row.project_name,
        contactName: row.primary_contact_name || undefined,
        contactEmail: row.contact_email || undefined,
        contactPhone: row.contact_phone || undefined,
        projectAddress: row.project_address || undefined,
        status: mapStatus(row.deal_stage, row.status),
        priority: mapPriority(row.priority),
        source: row.lead_source || undefined,
        estimatedValue: row.estimated_value ? Number(row.estimated_value) : undefined,
        squareFootage: row.total_sqft ? Number(row.total_sqft) : undefined,
        buildingType: row.primary_building_type || undefined,
        notes: row.internal_notes || undefined,
        createdAt: row.created_at instanceof Date
            ? row.created_at.toISOString()
            : String(row.created_at),
        updatedAt: row.updated_at instanceof Date
            ? row.updated_at.toISOString()
            : row.updated_at ? String(row.updated_at) : undefined,
    };
}

// ── GET /api/leads ──
router.get('/', async (_req: Request, res: Response) => {
    try {
        const results = await db.execute(sql`
            SELECT
                sf.id,
                sf.client_company,
                sf.project_name,
                sf.primary_contact_name,
                sf.contact_email,
                sf.contact_phone,
                sf.project_address,
                sf.deal_stage,
                sf.status,
                sf.priority,
                sf.lead_source,
                sf.internal_notes,
                sf.created_at,
                sf.updated_at,
                (SELECT (q.totals->>'totalClientPrice')::numeric
                 FROM quotes q
                 WHERE q.scoping_form_id = sf.id
                 ORDER BY q.version DESC NULLS LAST, q.created_at DESC
                 LIMIT 1) as estimated_value,
                (SELECT COALESCE(SUM(sa.square_footage), 0)
                 FROM scope_areas sa
                 WHERE sa.scoping_form_id = sf.id) as total_sqft,
                (SELECT sa.area_type
                 FROM scope_areas sa
                 WHERE sa.scoping_form_id = sf.id
                 ORDER BY sa.sort_order
                 LIMIT 1) as primary_building_type
            FROM scoping_forms sf
            WHERE sf.status != 'deleted'
            ORDER BY sf.updated_at DESC
        `);

        res.json(results.rows.map(rowToLead));
    } catch (error: any) {
        console.error('List leads error:', error);
        res.status(500).json({ error: 'Failed to fetch leads' });
    }
});

// ── GET /api/leads/:id ──
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }

        const results = await db.execute(sql`
            SELECT
                sf.id, sf.client_company, sf.project_name,
                sf.primary_contact_name, sf.contact_email, sf.contact_phone,
                sf.project_address, sf.deal_stage, sf.status, sf.priority,
                sf.lead_source, sf.internal_notes, sf.created_at, sf.updated_at,
                (SELECT (q.totals->>'totalClientPrice')::numeric
                 FROM quotes q WHERE q.scoping_form_id = sf.id
                 ORDER BY q.version DESC NULLS LAST, q.created_at DESC LIMIT 1) as estimated_value,
                (SELECT COALESCE(SUM(sa.square_footage), 0)
                 FROM scope_areas sa WHERE sa.scoping_form_id = sf.id) as total_sqft,
                (SELECT sa.area_type FROM scope_areas sa
                 WHERE sa.scoping_form_id = sf.id ORDER BY sa.sort_order LIMIT 1) as primary_building_type
            FROM scoping_forms sf WHERE sf.id = ${id}
        `);

        if (results.rows.length === 0) { res.status(404).json({ error: 'Lead not found' }); return; }
        res.json(rowToLead(results.rows[0]));
    } catch (error: any) {
        console.error('Get lead error:', error);
        res.status(500).json({ error: 'Failed to fetch lead' });
    }
});

// ── POST /api/leads ──
router.post('/', async (req: Request, res: Response) => {
    try {
        const { clientName, projectName, contactName, contactEmail, contactPhone,
                projectAddress, status, priority, source, notes, squareFootage, buildingType } = req.body;

        // Generate UPID
        const seqResult = await db.execute(sql`SELECT nextval('upid_seq') as seq`);
        const seq = (seqResult.rows[0] as { seq: string }).seq;
        const upid = `S2P-${String(seq).padStart(4, '0')}-${new Date().getFullYear()}`;

        const priorityInt = priority === 'high' ? 2 : priority === 'medium' ? 3 : 4;
        const { dealStage, formStatus } = reverseMapStatus(status || 'lead');

        const [form] = await db.insert(scopingForms).values({
            upid,
            status: formStatus || 'draft',
            clientCompany: clientName || 'Unknown',
            projectName: projectName || 'Untitled Project',
            projectAddress: projectAddress || 'TBD',
            email: contactEmail || 'unknown@example.com',
            primaryContactName: contactName || 'Unknown',
            contactEmail: contactEmail || 'unknown@example.com',
            contactPhone: contactPhone || null,
            numberOfFloors: 1,
            bimDeliverable: 'Revit',
            georeferencing: false,
            era: 'Modern',
            roomDensity: 2,
            riskFactors: [],
            expedited: false,
            dispatchLocation: 'Troy NY',
            oneWayMiles: 0,
            travelMode: 'Local',
            leadSource: source || 'Other',
            probability: 50,
            dealStage,
            priority: priorityInt,
            internalNotes: notes || null,
        }).returning();

        if (buildingType || squareFootage) {
            await db.insert(scopeAreas).values({
                scopingFormId: form.id,
                areaType: buildingType || 'Commercial',
                squareFootage: squareFootage || 0,
                projectScope: 'Full',
                lod: '300',
                cadDeliverable: 'No',
                sortOrder: 0,
            });
        }

        res.status(201).json({
            id: form.id,
            clientName: form.clientCompany,
            projectName: form.projectName,
            contactName: form.primaryContactName,
            contactEmail: form.contactEmail,
            contactPhone: form.contactPhone,
            projectAddress: form.projectAddress,
            status: mapStatus(form.dealStage, form.status),
            priority: mapPriority(form.priority),
            source: form.leadSource,
            squareFootage: squareFootage || undefined,
            buildingType: buildingType || undefined,
            notes: form.internalNotes || undefined,
            createdAt: form.createdAt.toISOString(),
            updatedAt: form.updatedAt.toISOString(),
        });
    } catch (error: any) {
        console.error('Create lead error:', error);
        res.status(400).json({ error: error.message || 'Failed to create lead' });
    }
});

// ── PATCH /api/leads/:id ──
router.patch('/:id', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }

        const updates: Record<string, any> = { updatedAt: new Date() };
        const { clientName, projectName, contactName, contactEmail,
                contactPhone, projectAddress, status, priority, source, notes } = req.body;

        if (clientName !== undefined) updates.clientCompany = clientName;
        if (projectName !== undefined) updates.projectName = projectName;
        if (contactName !== undefined) updates.primaryContactName = contactName;
        if (contactEmail !== undefined) { updates.contactEmail = contactEmail; updates.email = contactEmail; }
        if (contactPhone !== undefined) updates.contactPhone = contactPhone;
        if (projectAddress !== undefined) updates.projectAddress = projectAddress;
        if (source !== undefined) updates.leadSource = source;
        if (notes !== undefined) updates.internalNotes = notes;
        if (priority !== undefined) updates.priority = priority === 'high' ? 2 : priority === 'medium' ? 3 : 4;
        if (status !== undefined) {
            const mapped = reverseMapStatus(status);
            updates.dealStage = mapped.dealStage;
            if (mapped.formStatus) updates.status = mapped.formStatus;
        }

        const [updated] = await db.update(scopingForms)
            .set(updates).where(eq(scopingForms.id, id)).returning();

        if (!updated) { res.status(404).json({ error: 'Lead not found' }); return; }

        res.json({
            id: updated.id,
            clientName: updated.clientCompany,
            projectName: updated.projectName,
            status: mapStatus(updated.dealStage, updated.status),
            priority: mapPriority(updated.priority),
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
        });
    } catch (error: any) {
        console.error('Update lead error:', error);
        res.status(400).json({ error: error.message || 'Failed to update lead' });
    }
});

export default router;
