import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

@Injectable()
export class RewardService {
  constructor(
    private dataSource: DataSource
  ) {}

  async total_reward_in_your_account(user_id:any,category: number) {
    try {

         const data = await this.dataSource.query(
      `
      SELECT *
      FROM reward_point_balance rpb
      LEFT JOIN member_tier mt ON mt.id = rpb.mem_id
      WHERE user_id = ?
      `,
      [user_id],
    );
    return data;
     
    } catch (error) {
      console.log(error);
      throw new BadRequestException('Failed to fetch loyalty data');
    }
  }

}