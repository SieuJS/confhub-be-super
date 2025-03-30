
import { Injectable } from '@nestjs/common';
import { UserService } from '../../user/services/user.service'
import * as crypto from 'crypto'
import { UserDTO } from 'src/modules/user/models/user.dto';
import { JwtService } from '@nestjs/jwt';
import { AdminService } from 'src/modules/user/services/admin.service';
import { AdminDto } from 'src/modules/user/models/admin/admin.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UserService,
    private admin : AdminService,
    private jwtService: JwtService
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.getUserByEmail(email)
    if(!user) {
        throw Error ("No email match")
    }

    const hashedInputPassword = crypto.createHash('sha256').update(password).digest('hex')
    const isPasswordValid = hashedInputPassword === user.password
    if(!isPasswordValid){
        throw Error ("Wrong password")
    }

    return user;
  }

  async validateAdmin (email: string, password: string): Promise<any> {
    const admin = await this.admin.getAdminByEmail(email)
    if(!admin) {
        throw Error ("No email match")
    }
    const hashedInputPassword = crypto.createHash('sha256').update(password).digest('hex')
    const isPasswordValid = hashedInputPassword === admin.password
    if(!isPasswordValid){
        throw Error ("Wrong password")
    }
    return admin;
  }

  async loginUser (user : UserDTO) {
    return {
        access_token : this.jwtService.sign({payload : {
          id : user.id,
          email : user.email,
          role : 'user'
        }})
    }
  }

  async loginAdmin (admin : AdminDto) {
    return {
        access_token : this.jwtService.sign({payload : {
          id : admin.id,
          email : admin.email,
          role : 'admin'
        }},)
    }
  }

}
