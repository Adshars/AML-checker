import { Op, type WhereOptions } from 'sequelize';
import type {
  IVerificationRepository,
  NewVerification,
  UpdateConditions,
  VerificationListQuery,
  VerificationListResult
} from '../../../../domain/repositories/IVerificationRepository.js';
import type { Verification, VerificationPatch } from '../../../../domain/entities/Verification.js';
import type { VerificationModelInstance, VerificationModelStatic } from '../models/VerificationModel.js';

// ILIKE wildcards typed by the user are matched literally
const escapeLike = (value: string): string => value.replace(/[\\%_]/g, (char) => `\\${char}`);

const toDomain = (row: VerificationModelInstance): Verification => row.get({ plain: true }) as Verification;

/**
 * Sequelize implementation of the Verification Repository
 */
export class SequelizeVerificationRepository implements IVerificationRepository {
  model: VerificationModelStatic;

  constructor(verificationModel: VerificationModelStatic) {
    this.model = verificationModel;
  }

  async create(verification: NewVerification): Promise<Verification> {
    const created = await this.model.create(verification);
    return toDomain(created);
  }

  async findByIdForOrganization(id: string, organizationId: string): Promise<Verification | null> {
    const row = await this.model.findOne({ where: { id, organizationId } });
    return row ? toDomain(row) : null;
  }

  async findByOrganization(organizationId: string, query: VerificationListQuery): Promise<VerificationListResult> {
    const { page, limit, status, from, to, search, includeDemo } = query;
    const where: Record<string | symbol, unknown> = { organizationId };

    if (status) where.status = status;
    if (!includeDemo) where.isDemo = false;

    if (from || to) {
      const createdAt: Record<symbol, Date> = {};
      if (from) createdAt[Op.gte] = from;
      if (to) createdAt[Op.lte] = to;
      where.createdAt = createdAt;
    }

    if (search) {
      const pattern = `%${escapeLike(search)}%`;
      where[Op.or] = [
        { externalRef: { [Op.iLike]: pattern } },
        { customerName: { [Op.iLike]: pattern } }
      ];
    }

    const { rows, count } = await this.model.findAndCountAll({
      where: where as WhereOptions<Verification>,
      order: [['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit
    });

    return { data: rows.map(toDomain), total: count };
  }

  async update(id: string, patch: VerificationPatch, conditions: UpdateConditions = {}): Promise<Verification | null> {
    const [affected] = await this.model.update(patch, {
      where: { id, ...conditions } as WhereOptions<Verification>
    });
    if (affected === 0) return null;

    const row = await this.model.findOne({ where: { id } });
    return row ? toDomain(row) : null;
  }
}

export default SequelizeVerificationRepository;
