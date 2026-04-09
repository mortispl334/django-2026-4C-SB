# from django.urls import path
# from . import views

# urlpatterns = [
#     path('', views.index, name='index'),
#     path('vote/<int:question_id>/', views.vote_view, name='vote'),
# ]

# app_name = 'polls'

# urlpatterns = [
#     path('', views.index, name='index'),
#     path('login/', views.login_view, name='login'),
#     path("register/", views.register_view, name="register"),
#     path('logout/', views.logout_view, name='logout'),
#     path('delete_user/', views.delete_user, name='delete_user'),
#     path('game/', views.chess_game, name='chess_game'),
# ]
from django.urls import path
from . import views

app_name = 'polls'

urlpatterns = [
    path('', views.index, name='index'),
    path('vote/<int:question_id>/', views.vote_view, name='vote'),
    path('login/', views.login_view, name='login'),
    path('register/', views.register_view, name='register'),
    path('logout/', views.logout_view, name='logout'),
    path('delete_user/', views.delete_user, name='delete_user'),
    path('game/', views.chess_game, name='chess_game'),
]