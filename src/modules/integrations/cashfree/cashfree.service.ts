import { Injectable, BadRequestException } from '@nestjs/common';


import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { IntegrationService } from '../integSettings/integSettings.service';
import { DataSource } from 'typeorm';

@Injectable()
export class CashfreeService {
  constructor(
    private readonly integrationService: IntegrationService,
    private readonly http: HttpService,
    private readonly dataSource: DataSource,
  ) {}

//   async verifyPan(pan: string) {
async subscription(body: any) {
  console.log(body)
  /*
  selected: 1,
  selectedPlan: 17,
  agreed: true,
  selectedModes: {},
  coupon: '',
  billing: '2' 
  */
  try {
    const config = await this.integrationService.getIntegrationConfig(
      'cashfree',
    );

    const configData =
      typeof config === 'string'
        ? JSON.parse(config)
        : config;

    console.log(
      'URL:',
      `${configData.base_url}/pg/subscriptions`,
    );
 const subscription_id =  `SUB_${Date.now()}`;
    const response = await firstValueFrom(
      this.http.post(
        `${configData.base_url}/pg/subscriptions`,
          {
      subscription_id: subscription_id,
      customer_details: {
        customer_name: 'Saleem',
        customer_email: 'vb.develop1@gmail.com',
        customer_phone: '8147484371',
      },
      plan_details: {
        plan_id: 'Plan_8921_6',
      },
       subscription_meta: {
   return_url: `${process.env.FRONTEND_URL}/subscription-success?subscription_id=${subscription_id}`,
},
      
    },
        {
          headers: {
            'x-client-id': configData.client_id,
            'x-client-secret': configData.client_secret,
            'x-api-version': '2025-01-01',
            'Content-Type': 'application/json',
          },
          
        },
        
      ),
    );

    return response.data;
  } catch (error) {
   // console.log('Status:', error.response?.status);
   // console.log('Data:', error.response?.data);

    throw new BadRequestException(
     // error.response?.data || error.message,
     'error'
    );
  }
}

async verifySubscription(subscriptionId: string) {
  if (!subscriptionId) {
    throw new BadRequestException("subscriptionId is required");
  }

  const config = await this.integrationService.getIntegrationConfig("cashfree");

  const configData =
    typeof config === "string" ? JSON.parse(config) : config;

  try {
    const url = `${configData.base_url}/pg/subscriptions/${subscriptionId}`;
console.log(url)
    const response = await firstValueFrom(
      this.http.get(url, {
        headers: {
          "x-client-id": configData.client_id,
          "x-client-secret": configData.client_secret,
          "x-api-version": "2025-01-01",
        },
      }),
    );

    return response.data;
  } catch (error: any) {
    // better debugging
    console.error(
      "Cashfree verifySubscription error:",
      error?.response?.data || error.message,
    );

    throw new BadRequestException(
      error?.response?.data?.message || "Failed to verify subscription",
    );
  }
}
async cashfree_plans(parentId: string) 
{
 const rows = await this.dataSource.query(
  `SELECT * FROM vendor_options vo  LEFT JOIN plans p ON p.id = vo.option_key WHERE vo.parent_id = ? `,[parentId]);
return rows;
}

}