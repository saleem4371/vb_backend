import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotificationService } from '../../notifications/notification.service';
import { StorageService } from 'src/common/storage/storage.service';
import { MultipartFile } from '@fastify/multipart';

@Injectable()
export class AccountService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly notificationService: NotificationService,
    private readonly storageService: StorageService,
  ) {}

  async loadProfileApi(id: number) {
    const [user] = await this.dataSource.query(
      `SELECT * FROM users WHERE id = ?`,
      [id],
    );

    return user;
  }

  async updateProfile(
    id: number,
    data: any,
    avatar?: MultipartFile | null,
  ) {
    if (avatar) {
      const logo = await this.storageService.upload(
        avatar,
        `uploads/profile/${id}`,
      );

      data.logo = logo;
    }

    const fields = Object.keys(data);

    if (!fields.length) {
      throw new BadRequestException('No data to update');
    }

    const setClause = fields
      .map((field) => `${field} = ?`)
      .join(', ');

    const values = fields.map((field) => data[field]);

    values.push(id);

    await this.dataSource.query(
      `
      UPDATE users
      SET
        ${setClause},
        updated_at = NOW()
      WHERE id = ?
      `,
      values,
    );

    const [user] = await this.dataSource.query(
      `SELECT * FROM users WHERE id = ?`,
      [id],
    );

    return {
      success: true,
      message: 'Profile updated successfully',
      data: user,
    };
  }

  async rewardsApi(userId:Number)
  {
    const [user] = await this.dataSource.query(
      `SELECT * FROM reward_point_balance  rpb
      LEFT JOIN member_tier mt ON mt.id = rpb.mem_id
      WHERE user_id = ?`,
      [userId],
    );

    const memTier= await this.dataSource.query(
      `SELECT * FROM member_tier  `
    );

     const reward_history= await this.dataSource.query(
      `SELECT
    rpt.id,
    rpt.user_id,
    rpt.booking_id,
    rpt.points,
    rpt.transaction_type,
    rpt.created_at,

    b.booking_code,
    b.total_amount,

    cv.child_venue_name,

    CASE
        WHEN ed.first_date = ed.last_date THEN
            DATE_FORMAT(ed.first_date, '%e %b')
        ELSE
            CONCAT(
                DATE_FORMAT(ed.first_date, '%e %b'),
                ' - ',
                DATE_FORMAT(ed.last_date, '%e %b')
            )
    END AS event_date

FROM reward_point_transactions rpt

LEFT JOIN bookings b
    ON b.id = rpt.booking_id

LEFT JOIN booking_venues bv
    ON bv.booking_id = b.id

LEFT JOIN venue_child cv
    ON cv.child_venue_id = bv.child_venue_id

LEFT JOIN (
    SELECT
        booking_id,
        MIN(event_date) AS first_date,
        MAX(event_date) AS last_date
    FROM booking_event_dates
    GROUP BY booking_id
) ed
    ON ed.booking_id = b.id

WHERE rpt.user_id = ?

ORDER BY rpt.created_at DESC;`,[userId]
    );

    return {
      rewads : user,
      tier:memTier,
      history:reward_history
    }
  }

  async createLog(
    module: string,
    recordId: number,
    action: string,
    description: string,
    userId?: number,
    oldValue?: any,
    newValue?: any,
  ) {
    await this.dataSource.query(
      `
      INSERT INTO booking_logs
      (
        booking_id,
        action,
        description,
        old_value,
        new_value,
        created_by,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        recordId,
        action,
        description,
        JSON.stringify(oldValue ?? null),
        JSON.stringify(newValue ?? null),
        userId,
        new Date(),
      ],
    );
  }
}