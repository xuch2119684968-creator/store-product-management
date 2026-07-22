import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { cleanupUploadedImage, imageUpload, verifyUploadedImage } from "../middleware/upload";
import { saveProductImage } from "../services/objectStorage";

const router = Router();
router.use(requireAuth);

router.post("/image", imageUpload.single("image"), verifyUploadedImage, async (req, res, next) => {
  const image = req.file;
  if (!image) return res.status(400).json({ message: "请选择要上传的图片。" });
  try {
    const imagePath = await saveProductImage(image);
    return res.status(201).json({ message: "图片上传成功。", imagePath });
  } catch (error) {
    return next(error);
  } finally {
    await cleanupUploadedImage(image);
  }
});

export default router;
