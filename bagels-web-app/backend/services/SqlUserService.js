const { getPrisma, isPrismaEnabled } = require('../config/prisma');

class SqlUserService {
  normalizeUser(user) {
    const firstName = String(user.profile?.firstName || '').trim();
    const lastName = String(user.profile?.lastName || '').trim();
    const email = String(user.email || '').trim().toLowerCase();
    const name = `${firstName} ${lastName}`.trim() || email;

    return {
      mongoUserId: String(user._id),
      email,
      name,
      firstName: firstName || null,
      lastName: lastName || null,
      phone: user.phoneNumber || null,
      preferredCurrency: user.profile?.currency || 'INR',
      avatarUrl: user.profile?.avatar || null,
      emailVerified: Boolean(user.auth?.emailVerification?.verified),
      kycStatus: user.kycStatus || 'pending',
    };
  }

  async upsertFromMongoUser(user) {
    if (!isPrismaEnabled() || !user) return null;

    const prisma = getPrisma();
    const data = this.normalizeUser(user);
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { mongoUserId: data.mongoUserId },
          { email: data.email },
        ],
      },
    });

    if (existing) {
      return prisma.user.update({
        where: { id: existing.id },
        data,
      });
    }

    return prisma.user.create({ data });
  }

  async updateAvatarForMongoUser(user, avatarUrl, avatarPublicId) {
    if (!isPrismaEnabled() || !user) return null;

    const prisma = getPrisma();
    const sqlUser = await this.upsertFromMongoUser(user);
    if (!sqlUser) return null;

    return prisma.user.update({
      where: { id: sqlUser.id },
      data: {
        avatarUrl,
        avatarPublicId,
      },
    });
  }

  async recordUploadForMongoUser(user, file, uploadResult, uploadType = 'profile_avatar') {
    if (!isPrismaEnabled() || !user || !uploadResult?.public_id) return null;

    const prisma = getPrisma();
    const sqlUser = await this.upsertFromMongoUser(user);
    if (!sqlUser) return null;

    return prisma.uploadedFile.upsert({
      where: { cloudinaryPublicId: uploadResult.public_id },
      update: {
        url: uploadResult.url,
        secureUrl: uploadResult.secure_url || uploadResult.url,
        resourceType: uploadResult.resource_type || 'image',
        format: uploadResult.format || null,
        bytes: uploadResult.bytes || null,
        width: uploadResult.width || null,
        height: uploadResult.height || null,
        folder: uploadResult.folder || null,
        originalName: file?.originalname || null,
        mimeType: file?.mimetype || null,
        uploadType,
      },
      create: {
        userId: sqlUser.id,
        cloudinaryPublicId: uploadResult.public_id,
        url: uploadResult.url,
        secureUrl: uploadResult.secure_url || uploadResult.url,
        resourceType: uploadResult.resource_type || 'image',
        format: uploadResult.format || null,
        bytes: uploadResult.bytes || null,
        width: uploadResult.width || null,
        height: uploadResult.height || null,
        folder: uploadResult.folder || null,
        originalName: file?.originalname || null,
        mimeType: file?.mimetype || null,
        uploadType,
      },
    });
  }

  async deleteByMongoUserId(userId) {
    if (!isPrismaEnabled() || !userId) return { count: 0 };

    return getPrisma().user.deleteMany({
      where: { mongoUserId: String(userId) },
    });
  }
}

module.exports = new SqlUserService();
