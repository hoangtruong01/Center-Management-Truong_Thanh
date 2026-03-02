'use client';

import { useState, useEffect } from 'react';
import {
    teacherGradingService,
    GradingSheet,
    StudentGrade,
    CreateGradingSheetDto,
    GradeCategory,
    GRADE_CATEGORY_LABELS,
} from '@/lib/services/teacher-grading.service';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function TeacherGradingTab() {
    const [gradingSheets, setGradingSheets] = useState<GradingSheet[]>([]);
    const [selectedSheet, setSelectedSheet] = useState<GradingSheet | null>(null);
    const [students, setStudents] = useState<StudentGrade[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showGradingModal, setShowGradingModal] = useState(false);

    // Load grading sheets
    useEffect(() => {
        loadGradingSheets();
    }, []);

    const loadGradingSheets = async () => {
        try {
            setLoading(true);
            const data = await teacherGradingService.getGradingSheets();
            setGradingSheets(data);
        } catch (error) {
            console.error('Failed to load grading sheets:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenGrading = async (sheet: GradingSheet) => {
        try {
            setSelectedSheet(sheet);
            setLoading(true);
            const data = await teacherGradingService.getGradingSheetWithStudents(sheet._id);
            setStudents(data.students);
            setShowGradingModal(true);
        } catch (error) {
            console.error('Failed to load students:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading && gradingSheets.length === 0) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Đang tải...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Quản lý Chấm Bài</h2>
                    <p className="text-gray-600 mt-1">Tạo bài kiểm tra và chấm điểm cho học sinh</p>
                </div>
                <Button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-blue-600 hover:bg-blue-700"
                >
                    + Tạo Chấm Bài
                </Button>
            </div>

            {/* Grading Sheets Table */}
            {gradingSheets.length === 0 ? (
                <Card className="p-12 text-center">
                    <svg
                        className="mx-auto h-12 w-12 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Chưa có bài chấm nào</h3>
                    <p className="mt-1 text-sm text-gray-500">Bắt đầu bằng cách tạo bài chấm điểm mới.</p>
                    <div className="mt-6">
                        <Button
                            onClick={() => setShowCreateModal(true)}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            + Tạo Chấm Bài
                        </Button>
                    </div>
                </Card>
            ) : (
                <Card>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Tên Bài
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Lớp
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Loại
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Điểm Tối Đa
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Ngày Tạo
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                        Hành Động
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {gradingSheets.map((sheet) => (
                                    <tr key={sheet._id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-gray-900">{sheet.title}</div>
                                            {sheet.description && (
                                                <div className="text-sm text-gray-500 truncate max-w-xs">
                                                    {sheet.description}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900">
                                            {sheet.classId?.name || '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getCategoryColor(sheet.category)}`}>
                                                {GRADE_CATEGORY_LABELS[sheet.category]}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900">
                                            {sheet.maxScore}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {new Date(sheet.createdAt).toLocaleDateString('vi-VN')}
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm font-medium">
                                            <button
                                                onClick={() => handleOpenGrading(sheet)}
                                                className="text-blue-600 hover:text-blue-900"
                                            >
                                                Chấm Điểm
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {/* Modals */}
            {showCreateModal && (
                <CreateGradingSheetModal
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={() => {
                        setShowCreateModal(false);
                        loadGradingSheets();
                    }}
                />
            )}

            {showGradingModal && selectedSheet && (
                <GradingModal
                    gradingSheet={selectedSheet}
                    students={students}
                    onClose={() => {
                        setShowGradingModal(false);
                        setSelectedSheet(null);
                    }}
                    onSuccess={() => {
                        setShowGradingModal(false);
                        loadGradingSheets();
                    }}
                />
            )}
        </div>
    );
}

function getCategoryColor(category: GradeCategory): string {
    switch (category) {
        case 'test_15p':
            return 'bg-blue-100 text-blue-800';
        case 'test_30p':
            return 'bg-purple-100 text-purple-800';
        case 'giua_ky':
            return 'bg-amber-100 text-amber-800';
        case 'cuoi_ky':
            return 'bg-red-100 text-red-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

// Create Grading Sheet Modal
function CreateGradingSheetModal({
    onClose,
    onSuccess,
}: {
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [loading, setLoading] = useState(false);
    const [classes, setClasses] = useState<any[]>([]);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        classId: '',
        category: 'test_15p' as GradeCategory,
        maxScore: 10,
    });

    useEffect(() => {
        loadClasses();
    }, []);

    const loadClasses = async () => {
        try {
            const data = await teacherGradingService.getMyClasses();
            setClasses(data);
        } catch (error) {
            console.error('Failed to load classes:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.title || !formData.classId) {
            alert('Vui lòng điền đầy đủ thông tin bắt buộc');
            return;
        }

        try {
            setLoading(true);
            await teacherGradingService.createGradingSheet(formData);
            onSuccess();
        } catch (error: any) {
            console.error('Failed to create grading sheet:', error);
            alert(`Không thể tạo bài chấm: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">Tạo Chấm Bài Mới</h3>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Title */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Tên Bài <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="VD: Kiểm tra 15 phút tuần 1"
                                required
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Mô Tả
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                rows={3}
                                placeholder="Mô tả chi tiết về bài kiểm tra..."
                            />
                        </div>

                        {/* Class */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Lớp <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.classId}
                                onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            >
                                <option value="">-- Chọn lớp --</option>
                                {classes.map((cls) => (
                                    <option key={cls._id} value={cls._id}>
                                        {cls.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Category */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Loại Bài <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value as GradeCategory })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            >
                                <option value="test_15p">Kiểm tra 15 phút</option>
                                <option value="test_30p">Kiểm tra 30 phút (1 tiết)</option>
                                <option value="giua_ky">Giữa kỳ</option>
                                <option value="cuoi_ky">Cuối kỳ</option>
                                <option value="khac">Khác</option>
                            </select>
                        </div>

                        {/* Max Score */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Điểm Tối Đa <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={formData.maxScore}
                                onChange={(e) => setFormData({ ...formData, maxScore: parseFloat(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            />
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-3 pt-4">
                            <Button
                                type="submit"
                                disabled={loading}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                {loading ? 'Đang tạo...' : 'Tạo Bài'}
                            </Button>
                            <Button
                                type="button"
                                onClick={onClose}
                                disabled={loading}
                                variant="outline"
                                className="flex-1"
                            >
                                Hủy
                            </Button>
                        </div>
                    </form>
                </div>
            </Card>
        </div>
    );
}

// Grading Modal - Chấm điểm hàng loạt
function GradingModal({
    gradingSheet,
    students,
    onClose,
    onSuccess,
}: {
    gradingSheet: GradingSheet;
    students: StudentGrade[];
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [grades, setGrades] = useState<{ [key: string]: { score: number | null; feedback: string } }>({});
    const [loading, setLoading] = useState(false);

    // Initialize grades from students data
    useEffect(() => {
        const initialGrades: { [key: string]: { score: number | null; feedback: string } } = {};
        students.forEach((student) => {
            initialGrades[student._id] = {
                score: student.score,
                feedback: student.feedback || '',
            };
        });
        setGrades(initialGrades);
    }, [students]);

    const updateGrade = (studentId: string, field: 'score' | 'feedback', value: any) => {
        setGrades((prev) => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                [field]: value,
            },
        }));
    };

    const handleSubmit = async () => {
        // Filter students with scores
        const gradesToSubmit = Object.entries(grades)
            .filter(([_, data]) => data.score !== null && data.score !== undefined)
            .map(([studentId, data]) => ({
                studentId,
                score: data.score as number,
                feedback: data.feedback || undefined,
            }));

        if (gradesToSubmit.length === 0) {
            alert('Vui lòng nhập điểm cho ít nhất một học sinh');
            return;
        }

        try {
            setLoading(true);
            await teacherGradingService.bulkGradeStudents(gradingSheet._id, { grades: gradesToSubmit });
            alert(`✅ Đã cập nhật điểm cho ${gradesToSubmit.length} học sinh`);
            onSuccess();
        } catch (error: any) {
            console.error('Failed to submit grades:', error);
            alert(`Không thể cập nhật điểm: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const gradedCount = students.filter((s) => s.graded).length;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">{gradingSheet.title}</h3>
                            <p className="text-sm text-gray-600 mt-1">
                                {gradingSheet.classId?.name} | {GRADE_CATEGORY_LABELS[gradingSheet.category]} | Điểm tối đa: {gradingSheet.maxScore}
                            </p>
                            <p className="text-sm text-gray-500">
                                Đã chấm: {gradedCount}/{students.length} học sinh
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            ✕
                        </button>
                    </div>

                    {students.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-500">Lớp chưa có học sinh nào</p>
                        </div>
                    ) : (
                        <div className="space-y-3 mb-4">
                            {students.map((student) => (
                                <div
                                    key={student._id}
                                    className="border border-gray-200 rounded-lg p-4"
                                >
                                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-900">{student.name}</p>
                                            <p className="text-sm text-gray-600">{student.email}</p>
                                            {student.studentCode && (
                                                <p className="text-xs text-gray-500">Mã HS: {student.studentCode}</p>
                                            )}
                                        </div>
                                        <div className="flex flex-col md:flex-row gap-3">
                                            <div className="flex items-center gap-2">
                                                <label className="text-sm text-gray-600">Điểm:</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={gradingSheet.maxScore}
                                                    step="0.5"
                                                    value={grades[student._id]?.score ?? ''}
                                                    onChange={(e) => updateGrade(student._id, 'score', e.target.value ? parseFloat(e.target.value) : null)}
                                                    className="w-20 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="--"
                                                />
                                                <span className="text-sm text-gray-500">/{gradingSheet.maxScore}</span>
                                            </div>
                                            <input
                                                type="text"
                                                value={grades[student._id]?.feedback || ''}
                                                onChange={(e) => updateGrade(student._id, 'feedback', e.target.value)}
                                                className="flex-1 min-w-50 px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="Nhận xét (tùy chọn)"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex gap-3 pt-4 border-t">
                        <Button
                            onClick={handleSubmit}
                            disabled={loading || students.length === 0}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        >
                            {loading ? 'Đang lưu...' : 'Cập Nhật Điểm'}
                        </Button>
                        <Button
                            onClick={onClose}
                            disabled={loading}
                            variant="outline"
                            className="flex-1"
                        >
                            Đóng
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
