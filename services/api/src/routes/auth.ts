import { Router } from "express";
import { supabase } from "../config/database";
import { getKakaoUserByToken } from "../services/kakao-auth.service";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken
} from "../utils/jwt";
import { authMiddleware } from "../middleware/auth";
import { sanitizePublicText } from "../utils/response-safety";

const authRouter = Router();

// 카카오 로그인 (모바일에서 카카오 토큰을 받아서 보내줌)
authRouter.post("/login/kakao", async (req, res) => {
  try {
    const { kakaoAccessToken } = req.body as { kakaoAccessToken?: string };

    if (!kakaoAccessToken) {
      return res.status(400).json({ message: "카카오 액세스 토큰이 필요합니다" });
    }

    // 카카오에서 유저 정보 가져오기
    const kakaoUser = await getKakaoUserByToken(kakaoAccessToken);
    const kakaoId = String(kakaoUser.id);
    const nickname = kakaoUser.kakao_account?.profile?.nickname ?? "여행자";
    const email = kakaoUser.kakao_account?.email ?? null;
    const profileImage = kakaoUser.kakao_account?.profile?.profile_image_url ?? null;

    // DB에서 유저 찾기 또는 새로 만들기
    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("kakao_id", kakaoId)
      .single();

    let user;

    if (!existingUser) {
      const { data: newUser, error: insertError } = await supabase
        .from("users")
        .insert({
          kakao_id: kakaoId,
          nickname,
          email,
          profile_image: profileImage,
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(insertError.message);
      }
      user = newUser;
    } else {
      const { data: updatedUser, error: updateError } = await supabase
        .from("users")
        .update({
          nickname,
          email,
          profile_image: profileImage,
        })
        .eq("kakao_id", kakaoId)
        .select()
        .single();

      if (updateError) {
        throw new Error(updateError.message);
      }
      user = updatedUser;
    }

    // JWT 토큰 발급
    const tokenPayload = { userId: user.id, kakaoId: user.kakao_id };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    return res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        nickname: user.nickname,
        email: user.email,
        profileImage: user.profile_image
      }
    });
  } catch (error) {
    const message = error instanceof Error ? sanitizePublicText(error.message) : "unknown";
    console.error(`[auth] Kakao login failed: ${message || "unknown"}`);
    return res.status(500).json({ message: "로그인 처리 중 오류가 발생했습니다" });
  }
});

// 토큰 갱신
authRouter.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };

    if (!refreshToken) {
      return res.status(400).json({ message: "리프레시 토큰이 필요합니다" });
    }

    const payload = verifyRefreshToken(refreshToken);
    const newAccessToken = generateAccessToken({
      userId: payload.userId,
      kakaoId: payload.kakaoId
    });

    return res.json({ accessToken: newAccessToken });
  } catch {
    return res.status(401).json({ message: "유효하지 않은 리프레시 토큰입니다" });
  }
});

// 내 정보 조회
authRouter.get("/me", authMiddleware, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("id, nickname, email, profile_image, created_at")
      .eq("id", req.user!.userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
    }

    return res.json({
      user: {
        id: user.id,
        nickname: user.nickname,
        email: user.email,
        profileImage: user.profile_image,
        createdAt: user.created_at,
      }
    });
  } catch {
    return res.status(500).json({ message: "사용자 정보 조회 중 오류가 발생했습니다" });
  }
});

// 로그아웃 (클라이언트에서 토큰 삭제)
authRouter.post("/logout", (_req, res) => {
  return res.json({ message: "로그아웃 완료" });
});

export { authRouter };
