import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Term, TermDocument } from './schemas/term.schema';
import { Lecture, LectureDocument } from './schemas/lecture.schema';
import { SettingsService } from '@/settings/settings.service';
import { CreateTermDto, UpdateTermDto, ReorderDto } from './dto';

@Injectable()
export class TermsService {
  constructor(
    @InjectModel(Term.name) private termModel: Model<TermDocument>,
    @InjectModel(Lecture.name) private lectureModel: Model<LectureDocument>,
    private settingsService: SettingsService,
  ) {}

  private objectId(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('معرّف غير صحيح');
    return new Types.ObjectId(id);
  }

  private async currentAcademicYear(): Promise<string> {
    const { data } = await this.settingsService.getSettings();
    return data.currentAcademicYear;
  }

  async create(dto: CreateTermDto) {
    const academicYear = dto.academicYear ?? (await this.currentAcademicYear());

    const term = await this.termModel.create({
      titleAr: dto.titleAr,
      grade: dto.grade,
      academicYear,
      order: dto.order ?? (await this.termModel.countDocuments({ grade: dto.grade, academicYear })),
    });

    return { success: true, message: 'تم إنشاء الترم', data: term };
  }

  async findAll(includeArchived = false) {
    const filter = includeArchived ? {} : { isArchived: false };
    const terms = await this.termModel.find(filter).sort({ grade: 1, order: 1 }).lean();
    return { success: true, message: 'Terms retrieved', data: terms };
  }

  async update(id: string, dto: UpdateTermDto) {
    const term = await this.termModel.findById(this.objectId(id));
    if (!term) throw new NotFoundException('الترم غير موجود');

    const gradeOrYearChanged =
      (dto.grade && dto.grade !== term.grade) ||
      (dto.academicYear && dto.academicYear !== term.academicYear);

    Object.assign(term, dto);
    await term.save();

    // Lectures copy grade and academicYear from their term for the catalogue
    // query. Letting the term change without propagating would leave lectures
    // filed under a grade the term no longer belongs to — invisible in the
    // catalogue and impossible to explain.
    if (gradeOrYearChanged) {
      await this.lectureModel.updateMany(
        { term: term._id },
        { $set: { grade: term.grade, academicYear: term.academicYear } },
      );
    }

    return { success: true, message: 'تم تحديث الترم', data: term };
  }

  async reorder(dto: ReorderDto) {
    await this.termModel.bulkWrite(
      dto.ids.map((id, index) => ({
        updateOne: { filter: { _id: this.objectId(id) }, update: { $set: { order: index } } },
      })),
    );
    return { success: true, message: 'تم إعادة الترتيب', data: null };
  }

  async remove(id: string) {
    const _id = this.objectId(id);

    // Deleting a term would orphan its lectures — and a student may already
    // have bought one of them, so the content must stay reachable. Archiving
    // is the only safe "remove" here, and it is what the admin UI offers.
    const lectureCount = await this.lectureModel.countDocuments({ term: _id });
    if (lectureCount > 0) {
      throw new BadRequestException(
        `لا يمكن حذف ترم يحتوي على ${lectureCount} محاضرة. أرشِفه بدلاً من ذلك.`,
      );
    }

    const deleted = await this.termModel.findByIdAndDelete(_id);
    if (!deleted) throw new NotFoundException('الترم غير موجود');

    return { success: true, message: 'تم حذف الترم', data: null };
  }

  // Rolling the academic year over: archive everything from the old year in
  // one operation, rather than the incumbent's situation where 107 of 117
  // items sit dead in the same list as the live ones.
  async archiveAcademicYear(academicYear: string) {
    const [terms, lectures] = await Promise.all([
      this.termModel.updateMany({ academicYear }, { $set: { isArchived: true } }),
      this.lectureModel.updateMany({ academicYear }, { $set: { isArchived: true } }),
    ]);

    return {
      success: true,
      message: `تمت أرشفة العام الدراسي ${academicYear}`,
      data: {
        termsArchived: terms.modifiedCount,
        lecturesArchived: lectures.modifiedCount,
      },
    };
  }
}
