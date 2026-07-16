/**
 * Login Request DTO
 */
export class LoginRequestDto {
    email;
    password;
    constructor({ email, password }) {
        this.email = email?.toLowerCase()?.trim();
        this.password = password;
    }
    static fromRequest(body) {
        return new LoginRequestDto({
            email: body.email,
            password: body.password
        });
    }
}
export default LoginRequestDto;
