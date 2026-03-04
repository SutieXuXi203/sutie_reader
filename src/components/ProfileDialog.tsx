'use client';

import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { User, Loader2, ImagePlus, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/providers/AuthContext';
import Image from 'next/image';
import Cropper, { Area } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { getCroppedImg } from '@/lib/cropImage';

interface ProfileDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ProfileDialog({ open, onOpenChange }: ProfileDialogProps) {
    const { user, login } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [name, setName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);

    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

    useEffect(() => {
        if (user && open) {
            setName(user.name || '');
            setAvatarUrl(user.avatar || '');
            setError('');
            setSuccess('');
            setImageSrc(null);
            setZoom(1);
        }
    }, [user, open]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            setError('Kích thước ảnh không được vượt quá 5MB');
            return;
        }

        setIsUploading(true);
        setError('');

        const reader = new FileReader();
        reader.onloadend = () => {
            setImageSrc(reader.result as string);
            setIsUploading(false);
        };
        reader.readAsDataURL(file);
    };

    const onCropComplete = (croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    };

    const applyCrop = async () => {
        if (!imageSrc || !croppedAreaPixels) return;

        try {
            setIsUploading(true);
            const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
            setAvatarUrl(croppedImage);
            setImageSrc(null);
        } catch (e: any) {
            setError('Không thể cắt ảnh');
            console.error(e);
        } finally {
            setIsUploading(false);
        }
    };

    const cancelCrop = () => {
        setImageSrc(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            const res = await fetch('/api/auth/me', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, avatar: avatarUrl }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Cập nhật không thành công');
            }

            setSuccess('Cập nhật thông tin thành công!');

            if (user) {
                login({ ...user, name: data.user.name, avatar: data.user.avatar });
            }

            setTimeout(() => {
                onOpenChange(false);
            }, 1500);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (!user) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="sm:max-w-md bg-card border-border"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-center text-card-foreground mb-2">
                        Hồ sơ của bạn
                    </DialogTitle>
                    <DialogDescription className="text-center text-muted-foreground">
                        Cập nhật thông tin cá nhân và ảnh đại diện
                    </DialogDescription>
                </DialogHeader>

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-none text-sm font-medium border border-red-100 dark:border-red-900/30">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 p-3 rounded-none text-sm font-medium border border-green-100 dark:border-green-900/30">
                        <CheckCircle2 className="w-5 h-5" />
                        {success}
                    </div>
                )}

                {imageSrc ? (
                    <div className="flex flex-col gap-4 mt-4 h-[400px]">
                        <div className="relative w-full grow bg-black">
                            <Cropper
                                image={imageSrc}
                                crop={crop}
                                zoom={zoom}
                                aspect={1}
                                cropShape="round"
                                showGrid={false}
                                onCropChange={setCrop}
                                onCropComplete={onCropComplete}
                                onZoomChange={setZoom}
                            />
                        </div>
                        <div className="px-4">
                            <input
                                type="range"
                                value={zoom}
                                min={1}
                                max={3}
                                step={0.1}
                                aria-labelledby="Zoom"
                                onChange={(e) => setZoom(Number(e.target.value))}
                                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                            />
                        </div>
                        <div className="flex justify-end gap-2 mt-2">
                            <Button type="button" variant="outline" onClick={cancelCrop} className="rounded-[8px]">Hủy</Button>
                            <Button type="button" onClick={applyCrop} disabled={isUploading} className="rounded-[8px] bg-primary text-primary-foreground hover:bg-primary/90">
                                {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Cắt & Lưu
                            </Button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6 mt-4">

                        <div className="flex flex-col items-center gap-4">
                            <div
                                className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-border bg-muted group cursor-pointer"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <User className="w-10 h-10 text-muted-foreground" />
                                    </div>
                                )}

                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <ImagePlus className="w-6 h-6 text-white" />
                                </div>

                                {isUploading && (
                                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                                        <Loader2 className="w-6 h-6 animate-spin text-foreground" />
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground font-medium tracking-tight">Nhấn vào ảnh để thay đổi</p>
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleImageUpload}
                            />
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Email</label>
                                <Input
                                    type="text"
                                    value={user.email}
                                    disabled
                                    className="bg-muted text-muted-foreground cursor-not-allowed"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Tên hiển thị</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="text"
                                        placeholder="Tên của bạn"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="pl-10"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={isLoading || isUploading}
                            className="rounded-none w-full shadow-lg h-12 text-base font-bold bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            {isLoading ? (
                                <div className="flex items-center gap-2">
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Đang lưu...
                                </div>
                            ) : (
                                'Lưu thay đổi'
                            )}
                        </Button>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
