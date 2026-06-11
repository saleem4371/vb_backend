import { Injectable, BadRequestException } from '@nestjs/common';


import { HttpService } from '@nestjs/axios';
import { IntegrationService } from '../integSettings/integSettings.service';

import { DataSource } from 'typeorm';

@Injectable()
export class SurepassService {
  constructor(
    private readonly integrationService: IntegrationService,
     private readonly http: HttpService,
    private dataSource: DataSource,
  ) {}

//   async verifyPan(pan: string) {
 async verifyPan(body: any) {
    const config = await this.integrationService.getIntegrationConfig(
      'surepass',
    );
const [existingPan] = await this.dataSource.query(
  `SELECT id FROM user_kyc_documents WHERE document_number = ? LIMIT 1`,
  [body.pan]
);

if (existingPan) {
  return false;
}

//     const configData =
//         typeof config === 'string' ? JSON.parse(config) : config;

// console.log(`${configData.base_url}/api/v1/pan/pan`)

//     try {
//   const response = await this.http.axiosRef.post(
//     `${configData.base_url}/api/v1/pan/pan`,
//     {
//       id_number: body.pan,
//     },
//     {
//       headers: {
//         Authorization: `Bearer ${configData.api_key}`,
//         'Content-Type': 'application/json',
//       },
//     },
//   );

  return true;// response.data;
// } catch (error: any) {
//   console.log('Status:', error?.response?.status);
//   console.log('Data:', error?.response?.data);
//   console.log('Headers:', error?.response?.headers);

//   // throw error;
// }
  }
  
  async verifyBank(body: any) {
    const config = await this.integrationService.getIntegrationConfig(
      'surepass',
    );

const [existingBank] = await this.dataSource.query(
  `SELECT id FROM user_kyc_documents WHERE document_number = ? LIMIT 1`,
  [body.acct]
);

if (existingBank) {
  return false;
}
     const configData =
         typeof config === 'string' ? JSON.parse(config) : config;


     return this.http.axiosRef.post(
       `${configData.base_url}/api/v1/bank-verification/pennyless`,
      {
         id_number: body.acct,
    ifsc: body.acct,
    ifsc_details: true
       },
     {
         headers: {
          Authorization: `Bearer ${configData.api_key}`,
        },
      },
    );
  }  


  async verifyAdhar(body: any) {
    const config = await this.integrationService.getIntegrationConfig(
      'surepass',
    );

const [existingPan] = await this.dataSource.query(
  `SELECT id FROM user_kyc_documents WHERE document_number = ? LIMIT 1`,
  [body.aadhaarNumber]
);

if (existingPan) {
  return false;
} 

// curl --location 'https://kyc-api.surepass.app/api/v1/digilocker/initialize' \
// --header 'Authorization: Bearer <token>' \
// --header 'Content-Type: application/json' \
// --data '{
//     "data": {
//         "signup_flow": true,
//         "auth_type": "app"
//     }
// }'
    const configData =
        typeof config === 'string' ? JSON.parse(config) : config;


  


  const { data } = await this.http.axiosRef.post(
  `${configData.base_url}/api/v1/digilocker/initialize`,
  {
    data: {
      signup_flow: true,
     webhook_url: `${process.env.APP_URL}/thirdParty/digilocker/callback`,
      state: `user_${Date.now()}`,
      //send_email: true,
    },
  },
  {
    headers: {
      Authorization: `Bearer ${configData.api_key}`,
      "Content-Type": "application/json",
    },
  },
);

return data;

  }
async callback(body: any) {
  console.log(body)

}
  
}

