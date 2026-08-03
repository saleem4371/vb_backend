import {
  Controller,
  Get,
  UseGuards,
  Param,
  Put,
  Req,
  Patch,
  Post,
  Body,
  Query,
  Delete,
  Res,
  Headers
} from '@nestjs/common';
import type { FastifyRequest , FastifyReply } from 'fastify';


import { JwtAuthGuard } from '../../../modules/auth/strategies/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/user.decorator';

import { SurepassService } from './surepass.service';

@Controller('thirdParty')
export class SurepassController {
  constructor(private readonly surepassService: SurepassService) {}

    @UseGuards(JwtAuthGuard)
 @Post('verifyPAN')
pan_verify(@Body() body: string,@CurrentUser() user: any,@Headers('x-category') category:any , @Headers('x-country') country:any) {
  return this.surepassService.verifyPan(body, user?.id,category,country );
}
 @UseGuards(JwtAuthGuard)
 @Post('verifyGST')
verifyGST(@Body() body: string,@CurrentUser() user: any) {
  return this.surepassService.verifyGST(body,user?.id);
}  
@UseGuards(JwtAuthGuard)
 @Post('verifyBank')
verifyBank(@Body() body: string,@CurrentUser() user: any,@Headers('x-category') category:any , @Headers('x-country') country:any) {
  return this.surepassService.verifyBank(body,user?.id,category,country);
} 

@Post('verifyAdhar')
verifyAdhar(@Body() body: string) {
  return this.surepassService.verifyAdhar(body);
}
// @Post('digilocker/callback')
// callback(@Body() body: string) {
//   return this.surepassService.callback(body);
// }

// @Get('digilocker/callback')
// async callback(@Query() query, @Res() res) {
//   console.log(query); // <-- Is this getting called?

//   // Save data...

 
//   return res.redirect(
//   `https://venuebook-psi.vercel.app/vendor/kyc/success`,
// );
// }

 @Get('digilocker/callback')
async callback(
  @Query() query: any,
  @Res() reply: FastifyReply,
) {
  const result = await this.surepassService.handleCallback(query);

  return reply.type('text/html').send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Aadhaar Verification</title>

<style>
body{
    margin:0;
    background:#f4f7fb;
    font-family:Arial,sans-serif;
}
.card{
    width:520px;
    margin:60px auto;
    background:#fff;
    border-radius:12px;
    box-shadow:0 10px 30px rgba(0,0,0,.1);
    overflow:hidden;
}
.header{
    background:#0b6efd;
    color:#fff;
    text-align:center;
    padding:25px;
}
.success{
    font-size:70px;
}
.content{
    padding:30px;
}
table{
    width:100%;
    border-collapse:collapse;
}
td{
    padding:10px;
    border-bottom:1px solid #eee;
}
td:first-child{
    font-weight:bold;
    width:170px;
}
button{
    width:100%;
    background:#0b6efd;
    color:#fff;
    border:none;
    border-radius:8px;
    padding:14px;
    margin-top:25px;
    font-size:16px;
    cursor:pointer;
}
button:hover{
    background:#0958d9;
}
</style>

</head>

<body>

<div class="card">

<div class="header">
<div class="success">✅</div>
<h2>Aadhaar Verified Successfully</h2>
</div>

<div class="content">

<table>
<tr>
<td>Name</td>
<td>${result.name ?? ''}</td>
</tr>

<tr>
<td>Masked Aadhaar</td>
<td>${result.masked_aadhaar ?? ''}</td>
</tr>

<tr>
<td>Date of Birth</td>
<td>${result.dob ?? ''}</td>
</tr>

<tr>
<td>Gender</td>
<td>${result.gender ?? ''}</td>
</tr>

<tr>
<td>Mobile</td>
<td>${result.mobile ?? ''}</td>
</tr>

<tr>
<td>Address</td>
<td>${result.address ?? ''}</td>
</tr>

</table>

<button onclick="sendData()">
Continue
</button>

</div>

</div>

<script>

function sendData(){

    if(window.opener){

        window.opener.postMessage(
            {
                type:"DIGILOCKER_SUCCESS",
                data:${JSON.stringify(result)}
            },
            "*"
        );

        window.close();

    }else{

        alert("Verification completed.");

    }

}

</script>

</body>

</html>
`);
}

  @Post('digilocker/webhook')
  async webhook(@Body() body: any ,@Headers('x-category') category:any , @Headers('x-country') country:any) {
    console.log('Webhook hit');
    await this.surepassService.handleWebhook(body,category,country);

    return {
      success: true,
    };
  }

@Get('initializeDigilocker')
initializeDigilocker(@Body() body: string) {
  return this.surepassService.verifyAdhar(body);
}
 @UseGuards(JwtAuthGuard)
@Post('UploadDocument')
async UploadDocument(
  @Req() req: FastifyRequest,
  @CurrentUser() user: any,
) {
  try {
    const parts = req.parts();

    const body: any = {};
    let document: any = null;

    for await (const part of parts) {
      /*
      |--------------------------------------------------------------------------
      | FILE
      |--------------------------------------------------------------------------
      */
      if (part.type === 'file') {
        if (!part.filename) {
          continue;
        }

        const buffer = await part.toBuffer();

        if (!buffer || buffer.length === 0) {
          continue;
        }

        const fileData = {
          buffer,
          filename: part.filename,
          mimetype: part.mimetype,
        };

        if (part.fieldname === 'file') {
          document = fileData;
        }
      }

      /*
      |--------------------------------------------------------------------------
      | FIELDS
      |--------------------------------------------------------------------------
      */
      if (part.type === 'field') {
        body[part.fieldname] = String(part.value);
      }
    }

    return await this.surepassService.UploadDocument(
      document,
      body,
      user?.id,
    );
  } catch (error) {
    console.error(error);

  }
}
}
